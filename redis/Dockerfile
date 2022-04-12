FROM redislabs/redismod:latest

ARG redis_pw
ENV REDIS_PASSWORD=$redis_pw

# Install AWS CLI - used for backups to S3
RUN apt-get --assume-yes install curl
RUN apt-get --assume-yes install unzip
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

COPY redis.conf /usr/local/etc/redis/redis.conf

ENTRYPOINT ["/bin/sh", "-c", "redis-server /usr/local/etc/redis/redis.conf --requirepass $REDIS_PASSWORD"]

EXPOSE 6379