const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * SSL Certificate Utility for DoT/DoH
 * Generates self-signed certificates for Unbound DNS over TLS/HTTPS
 */
class SSLCertificateUtil {
    constructor() {
        this.certDir = '/etc/unbound';
        this.keyFile = path.join(this.certDir, 'unbound_server.key');
        this.certFile = path.join(this.certDir, 'unbound_server.pem');
        this.certValidityDays = 3650; // 10 years
    }

    /**
     * Check if Unbound supports TLS server functionality
     */
    async checkTLSServerSupport() {
        try {
            // Check if unbound was compiled with TLS server support
            // by looking for tls-service-key in help or checking version info
            const { stdout } = await execPromise('unbound -h 2>/dev/null | grep -i "tls-service-key" || echo "not found"');
            
            if (stdout.trim() === 'not found') {
                return {
                    supported: false,
                    reason: 'Unbound was not compiled with TLS server support (--enable-tls-server flag required)'
                };
            }
            
            return {
                supported: true,
                reason: 'TLS server support detected'
            };
        } catch (error) {
            return {
                supported: false,
                reason: `Could not determine TLS server support: ${error.message}`
            };
        }
    }

    /**
     * Automatically disable DoT/DoH if TLS server is not supported
     */
    async autoDisableUnsupportedFeatures() {
        try {
            const tlsSupport = await this.checkTLSServerSupport();
            
            if (!tlsSupport.supported) {
                console.log('⚠ TLS server not supported by Unbound, disabling DoT/DoH...');
                
                // Import settings utility to update settings
                const settingsUtil = require('./settings');
                
                const currentSettings = await settingsUtil.loadSettings();
                const updates = {
                    unbound: {
                        ...currentSettings.unbound,
                        dotEnabled: false,
                        dohEnabled: false
                    }
                };
                
                await settingsUtil.updateSettings(updates);
                console.log('✓ DoT and DoH automatically disabled');
                
                return {
                    disabled: true,
                    reason: tlsSupport.reason
                };
            }
            
            return {
                disabled: false,
                reason: tlsSupport.reason
            };
        } catch (error) {
            console.warn('Warning: Could not auto-disable unsupported features:', error.message);
            return {
                disabled: false,
                error: error.message
            };
        }
    }

    /**
     * Check if certificates exist and are valid
     */
    async certificatesExist() {
        try {
            await fs.access(this.keyFile);
            await fs.access(this.certFile);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if certificate is expired or will expire soon
     */
    async isCertificateExpired() {
        try {
            if (!await this.certificatesExist()) {
                return true;
            }

            // Check certificate expiry using openssl
            const { stdout } = await execPromise(`openssl x509 -in ${this.certFile} -noout -enddate`);
            const endDateMatch = stdout.match(/notAfter=(.+)/);

            if (!endDateMatch) {
                return true;
            }

            const endDate = new Date(endDateMatch[1]);
            const now = new Date();
            const daysUntilExpiry = Math.floor((endDate - now) / (1000 * 60 * 60 * 24));

            // Regenerate if expires within 30 days
            return daysUntilExpiry < 30;
        } catch (error) {
            console.warn('Error checking certificate expiry:', error.message);
            return true;
        }
    }

    /**
     * Generate self-signed SSL certificate for Unbound
     */
    async generateCertificate() {
        try {
            console.log('🔐 Generating self-signed SSL certificate for DoT/DoH...');

            // Ensure certificate directory exists
            await fs.ensureDir(this.certDir);

            // Generate private key
            console.log('  → Generating private key...');
            await execPromise(`openssl genrsa -out ${this.keyFile} 2048`);

            // Generate certificate signing request
            console.log('  → Generating certificate signing request...');
            const csrFile = path.join(this.certDir, 'unbound_server.csr');
            const subj = '/C=ID/ST=Jakarta/L=Jakarta/O=NDash/CN=localhost';
            await execPromise(`openssl req -new -key ${this.keyFile} -out ${csrFile} -subj "${subj}"`);

            // Generate self-signed certificate
            console.log('  → Generating self-signed certificate...');
            const startDate = new Date().toISOString().split('T')[0];
            const endDate = new Date(Date.now() + this.certValidityDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            await execPromise(`openssl x509 -req -in ${csrFile} -signkey ${this.keyFile} -out ${this.certFile} -days ${this.certValidityDays}`);

            // Clean up CSR file
            try {
                await fs.remove(csrFile);
            } catch (error) {
                // Ignore cleanup errors
            }

            // Set proper permissions
            await execPromise(`chmod 600 ${this.keyFile}`);
            await execPromise(`chmod 644 ${this.certFile}`);
            await execPromise(`chown unbound:unbound ${this.keyFile} ${this.certFile}`);

            console.log('✓ SSL certificate generated successfully');
            console.log(`  Key: ${this.keyFile}`);
            console.log(`  Cert: ${this.certFile}`);
            console.log(`  Valid until: ${endDate}`);

            return true;
        } catch (error) {
            console.error('✗ Failed to generate SSL certificate:', error.message);
            throw error;
        }
    }

    /**
     * Ensure certificates are available (generate if needed)
     */
    async ensureCertificates() {
        try {
            // First check TLS server support and auto-disable if needed
            const disableResult = await this.autoDisableUnsupportedFeatures();
            
            if (disableResult.disabled) {
                console.log(`📋 TLS server not supported: ${disableResult.reason}`);
                return {
                    keyFile: this.keyFile,
                    certFile: this.certFile,
                    exists: false,
                    tlsServerSupported: false,
                    reason: disableResult.reason
                };
            }

            if (!await this.certificatesExist() || await this.isCertificateExpired()) {
                console.log('📋 SSL certificates missing or expired, generating new ones...');
                await this.generateCertificate();
            } else {
                console.log('✓ SSL certificates are valid and up to date');
            }

            return {
                keyFile: this.keyFile,
                certFile: this.certFile,
                exists: true,
                tlsServerSupported: true
            };
        } catch (error) {
            console.error('✗ Failed to ensure SSL certificates:', error.message);
            return {
                keyFile: this.keyFile,
                certFile: this.certFile,
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Get certificate information
     */
    async getCertificateInfo() {
        try {
            const tlsSupport = await this.checkTLSServerSupport();
            
            if (!tlsSupport.supported) {
                return { 
                    exists: false, 
                    tlsServerSupported: false,
                    reason: tlsSupport.reason
                };
            }

            if (!await this.certificatesExist()) {
                return { 
                    exists: false, 
                    tlsServerSupported: true 
                };
            }

            const { stdout: certInfo } = await execPromise(`openssl x509 -in ${this.certFile} -text -noout`);
            const { stdout: expiryInfo } = await execPromise(`openssl x509 -in ${this.certFile} -noout -enddate`);

            const endDateMatch = expiryInfo.match(/notAfter=(.+)/);
            const expiryDate = endDateMatch ? new Date(endDateMatch[1]) : null;

            return {
                exists: true,
                tlsServerSupported: true,
                keyFile: this.keyFile,
                certFile: this.certFile,
                expiryDate: expiryDate,
                isExpired: expiryDate ? expiryDate < new Date() : true,
                daysUntilExpiry: expiryDate ? Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
            };
        } catch (error) {
            console.error('Error getting certificate info:', error.message);
            return { 
                exists: false, 
                error: error.message 
            };
        }
    }
}

module.exports = new SSLCertificateUtil();