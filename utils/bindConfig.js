const fs = require('fs-extra');

/**
 * Bind Configuration Manager
 * Manages /etc/bind/named.conf.local
 */

const NAMED_CONF_LOCAL = '/etc/bind/named.conf.local';

/**
 * Add zone to named.conf.local
 */
async function addZoneToConfig(zoneName, zoneFile) {
    try {
        let configContent = await fs.readFile(NAMED_CONF_LOCAL, 'utf8');
        
        // Check if zone already exists
        const zonePattern = new RegExp(`zone\\s+"${zoneName}"`, 'i');
        if (zonePattern.test(configContent)) {
            console.log(`Zone ${zoneName} already in config`);
            return;
        }
        
        // Prepare zone block
        const zoneBlock = `
zone "${zoneName}" {
    type master;
    file "${zoneFile}";
    allow-update { none; };
};
`;
        
        // Append to config
        await fs.appendFile(NAMED_CONF_LOCAL, zoneBlock);
        
    } catch (error) {
        throw new Error(`Failed to add zone to config: ${error.message}`);
    }
}

/**
 * Remove zone from named.conf.local
 */
/**
 * Remove a zone block from named.conf.local (content-only helper)
 * This function only manipulates the provided content string and returns the new content.
 * It is useful for dry-run testing and ensures brace-matching is correct.
 */
function removeZoneFromConfigContent(content, zoneName) {
    const search = new RegExp(`\\bzone\\s+"${zoneName}"`, 'i');
    const match = search.exec(content);
    if (!match) return content; // zone not found

    // Find index of the match and then the first '{' after it
    const startIndex = match.index;
    const afterMatch = content.slice(startIndex);
    const openBraceIndex = afterMatch.indexOf('{');
    if (openBraceIndex === -1) return content; // malformed, nothing to remove

    let idx = startIndex + openBraceIndex; // position of '{' in original content
    let braceCount = 0;
    let endIndex = -1;

    // scan from idx forward to find matching closing brace
    for (let i = idx; i < content.length; i++) {
        const ch = content[i];
        if (ch === '{') braceCount++;
        else if (ch === '}') {
            braceCount--;
            if (braceCount === 0) {
                // include any following semicolon and whitespace/newlines
                let j = i + 1;
                while (j < content.length && /[\s;\n\r]/.test(content[j])) j++;
                endIndex = j;
                break;
            }
        }
    }

    if (endIndex === -1) {
        // Couldn't find matching braces; don't modify
        return content;
    }

    // Remove the block from startIndex up to endIndex
    const before = content.slice(0, startIndex);
    const after = content.slice(endIndex);

    // Clean up resulting content: collapse multiple blank lines
    let newContent = (before + after).replace(/\n{3,}/g, '\n\n');
    // Trim leading/trailing blank lines but preserve final newline
    newContent = newContent.replace(/^\s+/, '').replace(/\s+$/, '') + '\n';
    return newContent;
}

/**
 * Remove zone from named.conf.local (safe, atomic write with backup)
 */
async function removeZoneFromConfig(zoneName) {
    try {
        // Backup current config
        const backupFile = `${NAMED_CONF_LOCAL}.backup.${Date.now()}`;
        await fs.copyFile(NAMED_CONF_LOCAL, backupFile);

        const configContent = await fs.readFile(NAMED_CONF_LOCAL, 'utf8');

        const cleanedContent = removeZoneFromConfigContent(configContent, zoneName);

        if (cleanedContent === configContent) {
            console.log(`Zone ${zoneName} not found in config, no changes made`);
            return;
        }

        // Write atomically to temp file then move into place
        const tmpFile = `${NAMED_CONF_LOCAL}.tmp.${Date.now()}`;
        await fs.writeFile(tmpFile, cleanedContent, 'utf8');
        await fs.move(tmpFile, NAMED_CONF_LOCAL, { overwrite: true });

        console.log(`✓ Removed zone ${zoneName} from config`);
        console.log(`✓ Backup saved: ${backupFile}`);
    } catch (error) {
        throw new Error(`Failed to remove zone from config: ${error.message}`);
    }
}

/**
 * List all zones from named.conf.local
 */
async function listConfiguredZones() {
    try {
        const configContent = await fs.readFile(NAMED_CONF_LOCAL, 'utf8');
        const zones = [];
        
        const zoneRegex = /zone\s+"([^"]+)"\s+\{[^}]*file\s+"([^"]+)";[^}]*\}/g;
        let match;
        
        while ((match = zoneRegex.exec(configContent)) !== null) {
            zones.push({
                name: match[1],
                file: match[2]
            });
        }
        
        return zones;
    } catch (error) {
        throw new Error(`Failed to list zones: ${error.message}`);
    }
}

module.exports = {
    addZoneToConfig,
    removeZoneFromConfig,
    listConfiguredZones,
    removeZoneFromConfigContent
};
