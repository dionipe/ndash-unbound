// Main JavaScript for NDash

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    initTooltips();
    
    // Auto-hide alerts
    autoHideAlerts();
    
    // Confirm delete actions
    initDeleteConfirms();
    
    // Real-time clock update
    updateClock();
    setInterval(updateClock, 1000);
});

function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.setAttribute('title', element.dataset.tooltip);
    });
}

function autoHideAlerts() {
    const alerts = document.querySelectorAll('.alert-auto-hide');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });
}

function initDeleteConfirms() {
    const deleteForms = document.querySelectorAll('form[data-confirm]');
    deleteForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!confirm(this.dataset.confirm || 'Are you sure?')) {
                e.preventDefault();
            }
        });
    });
}

function updateClock() {
    const clockElement = document.getElementById('current-time');
    if (clockElement) {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('en-US', { 
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Zone management functions
function reloadZone(zoneId) {
    if (confirm('Reload this zone configuration?')) {
        // In production, this would call the Bind reload API
        console.log('Reloading zone:', zoneId);
        alert('Zone reload initiated');
    }
}

function validateZoneForm(form) {
    const zoneName = form.querySelector('[name="name"]').value;
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    
    if (!domainRegex.test(zoneName)) {
        alert('Please enter a valid domain name');
        return false;
    }
    
    return true;
}

// Record management functions
function validateRecordForm(form) {
    const recordType = form.querySelector('[name="type"]').value;
    const recordValue = form.querySelector('[name="value"]').value;
    
    // Basic validation based on record type
    switch(recordType) {
        case 'A':
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipv4Regex.test(recordValue)) {
                alert('Invalid IPv4 address');
                return false;
            }
            break;
        case 'AAAA':
            // Basic IPv6 validation
            if (!recordValue.includes(':')) {
                alert('Invalid IPv6 address');
                return false;
            }
            break;
    }
    
    return true;
}

// Utility functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
