#!/bin/bash
echo "uploading hourly backup to S3"
aws s3 sync /data/ s3://$REDISBUCKET_NAME/hourly/
echo "hourly backup complete"