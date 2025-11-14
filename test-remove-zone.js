const fs = require('fs-extra');
const path = require('path');
const bindConfig = require('./utils/bindConfig');

const NAMED_CONF_LOCAL = '/etc/bind/named.conf.local';
const zoneName = process.argv[2];

if (!zoneName) {
    console.error('Usage: node test-remove-zone.js <zoneName>');
    process.exit(1);
}

(async () => {
    try {
        const content = await fs.readFile(NAMED_CONF_LOCAL, 'utf8');
        const newContent = bindConfig.removeZoneFromConfigContent(content, zoneName);

        if (newContent === content) {
            console.log(`Zone '${zoneName}' not found in config or nothing to change.`);
            process.exit(0);
        }

        const previewPath = `/tmp/named.conf.local.preview.${Date.now()}`;
        await fs.writeFile(previewPath, newContent, 'utf8');
        console.log(`Preview written to: ${previewPath}`);
        console.log('Run `sudo diff -u /etc/bind/named.conf.local ' + previewPath + '` to inspect changes.');
    } catch (err) {
        console.error('Error during dry-run:', err.message);
        process.exit(2);
    }
})();
