#!/bin/bash

aws s3 sync /data/ s3://$REDISBUCKET_NAME/nightly/
