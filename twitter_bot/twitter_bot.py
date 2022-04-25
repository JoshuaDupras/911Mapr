import time
from os import environ

import tweepy

from redis import Redis

# Twitter Bot Authentication
tweet_enabled = environ.get("TWEET_ENABLED", 'False').lower() in ('true', '1', 't')
c_key = environ.get("CONSUMER_KEY")
c_key_s = environ.get("CONSUMER_KEY_SECRET")
auth_tok = environ.get("AUTH_TOKEN")
auth_tok_s = environ.get("AUTH_TOKEN_SECRET")
link_domain = environ.get("LINK_DOMAIN", 'https://911mapr.com')

print(f'tweet enabled = {tweet_enabled}')


stream_key = environ.get("STREAM", "S:ROC")
poll_delay_s = 0.5


def connect_to_redis():
    return Redis(host=environ.get("REDIS_HOST", "localhost"),
                 port=environ.get("REDIS_PORT", 6379),
                 password=environ.get("REDIS_PASSWORD"),
                 retry_on_timeout=True,
                 decode_responses=True)


# Authenticate to Twitter
auth = tweepy.OAuthHandler(c_key, c_key_s)
auth.set_access_token(auth_tok, auth_tok_s)

r = connect_to_redis()

stream_info = r.xinfo_stream(name=stream_key)
print(f'stream_info={stream_info}')

last_id = stream_info['last-generated-id']
print(f'last ID = {last_id}')

bot = tweepy.API(auth)

while True:
    time.sleep(poll_delay_s)

    resp_list = r.xread(streams={stream_key: last_id}, count=1, block=5000)

    # print(f'read from redis with ID={last_id} - response of length {len(resp_list)}="{resp_list}"')

    if resp_list:
        resp_0 = resp_list[0]
        print(f'\nfound stream entry ==>"{resp_0}"')

        key, messages = resp_0
        last_id, data = messages[0]
        print(f"REDIS ID: {last_id}")
        print(f"DATA = {data}")

        link = f'{link_domain}/?inc={data["id"]}'
        tweet_text = f'{data["type"]} at {data["addr"]}\n\nView on map:{link}\n#ROC'
        tweet_text = tweet_text.replace('@', '@ ')

        print(f'generated tweet text = "{tweet_text}"')

        if data['new'] == '0':
            print(f'Ignoring incident status update for ID:{data["id"]}')
        elif tweet_enabled:
            print(f'tweeting enabled - sending tweet for ID:{data["id"]}')
            bot.update_status(tweet_text)
        else:
            print(f'TWEETING DISABLED - skipping ID:{data["id"]}')

    else:
        print('.', end='')
