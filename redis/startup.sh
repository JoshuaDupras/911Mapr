#!/bin/bash
echo "running startup.sh"

apt-get update
apt-get --assume-yes install cron

(crontab -l 2>/dev/null; echo "0 5 * * * /root/nightly-backup.sh") | crontab -

echo "startup.sh complete"