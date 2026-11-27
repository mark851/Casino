<?php
/**
 * CASINO ROYALE — Spaceship cPanel Secrets Template
 * Rename this file to casinoug-secrets.php (recommended: place one directory above public_html
 * or in your domain root protected by .htaccess) and fill in your cPanel MySQL & MarzPay credentials.
 */

return [
    'DB_DRIVER' => 'mysql',
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'your_cpanel_db_name',
    'DB_USER' => 'your_cpanel_db_user',
    'DB_PASSWORD' => 'your_cpanel_db_password',

    'ADMIN_PASSCODE' => '',

    'MARZPAY_API_KEY' => 'your_marzpay_api_key',
    'MARZPAY_API_SECRET' => 'your_marzpay_api_secret',
    'MARZPAY_WEBHOOK_SECRET' => 'your_marzpay_webhook_secret',
    'MARZPAY_BASE_URL' => 'https://wallet.wearemarz.com/api/v1',
    'MARZPAY_COUNTRY' => 'UG',
];
