FROM redislabs/redismod:latest

ARG redis_pw
ENV REDIS_PASSWORD=$redis_pw

COPY redis.conf /usr/local/etc/redis/redis.conf
COPY startup.sh /root/startup.sh
COPY nightly-backup.sh /root/nightly-backup.sh

RUN chmod +x /root/startup.sh && \
    chmod +x /root/nightly-backup.sh && \
    /root/startup.sh

ENTRYPOINT ["/bin/sh", "-c", "redis-server /usr/local/etc/redis/redis.conf --requirepass $REDIS_PASSWORD"]

EXPOSE 6379