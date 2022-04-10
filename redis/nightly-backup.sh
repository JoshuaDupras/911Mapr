#!/bin/bash
echo "uploading nightly backup to S3"
aws s3 sync /data/ s3://$REDISBUCKET_NAME/nightly/
echo "nightly backup complete"