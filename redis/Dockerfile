FROM redislabs/redismod:latest

ARG redis_pw
ENV REDIS_PASSWORD=$redis_pw

# Install AWS CLI - used for backups to S3
RUN apt-get update
RUN apt-get --assume-yes install wget
RUN apt-get --assume-yes install unzip
RUN wget https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -O /tmp/awscliv2.zip
RUN chmod +x /tmp/awscliv2.zip
RUN mkdir /aws
RUN unzip /tmp/awscliv2.zip -d /
RUN /aws/install
RUN aws --version

COPY redis.conf /usr/local/etc/redis/redis.conf

ENTRYPOINT ["/bin/sh", "-c", "redis-server /usr/local/etc/redis/redis.conf --requirepass $REDIS_PASSWORD"]

EXPOSE 6379