FROM redislabs/redismod:latest

ARG redis_pw
ENV REDIS_PASSWORD=$redis_pw

COPY redis.conf /usr/local/etc/redis/redis.conf

ENTRYPOINT ["/bin/sh", "-c", "redis-server /usr/local/etc/redis/redis.conf --requirepass $REDIS_PASSWORD"]

EXPOSE 6379