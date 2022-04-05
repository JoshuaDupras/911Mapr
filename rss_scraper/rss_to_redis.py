from datetime import datetime, timezone
import time
from os import environ

import feedparser
import redis.exceptions
from redis import Redis

stream_key = environ.get("STREAM", "monroe_county-NY-test")
producer = environ.get("PRODUCER", "user-1")
MAX_MESSAGES = int(environ.get("MESSAGES", "5000"))
location_str = 'ROC'
stream_name = f'S:{location_str}'
debug_mode = False  # generate debug incidents
delay_sec = 10


def connect_to_redis():
    return Redis(host=environ.get("REDIS_HOST", "localhost"),
                 port=environ.get("REDIS_PORT", 6379),
                 password=environ.get("REDIS_PASSWORD"),
                 retry_on_timeout=True,
                 decode_responses=True)


def get_ts():
    return time.strftime("%Y%m%d_%H%M%S")


def get_published_ts(rss_pub_date, raw_published_parsed):
    # print("getting mysqql TIMESTAMP from published entries")
    # print(f"raw_published={raw_published}")
    # print(f'raw_published_parsed={raw_published_parsed}')

    (dow, dd, mon, yyyy, hh_mm_ss, offset) = rss_pub_date.split(' ')

    ts = datetime.datetime(int(yyyy), )

    return ts


def expand_title_town_name(title):
    town_code_dict = {
        # Unknown / Not used / Never seen
        '???': 'Clarkson',
        '???': 'Sweden',
        '???': 'Parma',
        '???': 'Riga',
        '???': 'Wheatland',

        # Villages
        'BRO': 'Brockport',
        'CHU': 'Churchville',
        'FAI': 'Fairport',
        'HFL': 'Honeoye Falls',
        'HIL': 'Hilton',
        # '???': 'Village of Pittsford',  # overlap with Town of Pittsford
        'SCO': 'Scottsville',
        'SPE': 'Spencerport',
        # '???': 'Village of Webster',  # overlap with Town of Webster

        # Towns
        'BRI': 'Brighton',
        'CHI': 'Chili',
        'ERO': 'East Rochester',
        'GAT': 'Gates',
        'GRE': 'Greece',
        'HAM': 'Hamlin',
        'HEN': 'Henrietta',
        'IRO': 'Irondequoit',
        'OGD': 'Ogden',
        'PEN': 'Penfield',
        'PER': 'Perinton',
        'PIT': 'Pittsford',
        'ROC': 'Rochester',
        'RUS': 'Rush',
        'WBT': 'Webster',
    }

    title.split()
    for town_code, town_name in town_code_dict.items():
        new_title = title[-3:].replace(f' {town_code}', f', {town_name}')
        return new_title
    print(f"{ctime_now()}: WARNING - Couldn't replace town code in title: {title}")
    return title


def rss_to_redis():
    # print('\n\n##################################################')
    print(f'{ctime_now()}: connecting to RSS feed and scraping incidents')

    try:
        news_feed = feedparser.parse("https://www.monroecounty.gov/911/rss.php")
        entries = news_feed.entries
        print(f'{ctime_now()}: RSS contains {len(entries)} incidents - writing to Redis..')

        rc = connect_to_redis()

        for incident_dic in entries:
            # print('\n\n******************************************')
            print(f'    {time.strftime("%Y%m%d_%H%M%S")} - {incident_dic}')

            _split_title = incident_dic['title'].split(' at ', maxsplit=1)
            inc_type = _split_title[0]
            raw_inc_addr = _split_title[1]
            # inc_addr = expand_title_town_name(raw_inc_addr)  # TODO: decide how to make address more user friendly
            inc_addr = raw_inc_addr

            # inc_addr_split = inc_addr.split(' ')
            # inc_town_code = inc_addr_split[-1]
            # inc_town_name = expand_title_town_name(inc_town_code)

            # _raw_published = incident_dic['published']

            # convert feedparser "published_parsed" time to a UTC datetime object
            published_parsed_struct = incident_dic['published_parsed']
            # local = pytz.timezone("US/Eastern")
            # published_dt_naive =
            # published_dt_est = local.localize(published_dt_naive, is_dst=None)
            published_dt_utc = datetime(*published_parsed_struct[:6])
            # published_dt_utc = datetime.fromtimestamp(time.mktime(published_parsed_struct))

            inc_status = incident_dic['summary'].split(',')[0].split()[1]
            inc_id = incident_dic['summary'].split(',')[1].split()[1]
            inc_agency = inc_id[0:3]
            inc_geo_lat = incident_dic['geo_lat']
            inc_geo_lon = incident_dic['geo_long']

            inc_id_status = f'{inc_id}_{inc_status}'

            # published_ts = get_published_ts(raw_published, raw_published_parsed)

            ## Writing to REDIS
            # print(f'{ctime_now()}: writing to redis..')
            hash_name = f'{location_str}:{inc_id}'
            scraped_dt_utc = datetime.utcnow()

            # if published_dt_utc > scraped_dt_utc:
            #     # published datetime should never be past scraped time (now)
            #     # if this happens, use scraped time
            #     best_dt_utc = scraped_dt_utc
            # else:
            #     best_dt_utc = published_dt_utc

            best_dt_utc = scraped_dt_utc

            # TODO: 1 hash with multiple statuses show the same 'published time', might want to use scraped time?

            rc.hsetnx(name=hash_name, key=f'{inc_status}-scraped_utc', value=str(scraped_dt_utc))  # TODO: remove, if best_dt_utc works well
            rc.hsetnx(name=hash_name, key=f'{inc_status}-published_utc', value=str(published_dt_utc))  # TODO: remove, if best_dt_utc works well

            wrote_new_status = rc.hsetnx(name=hash_name, key=f'{inc_status}', value=str(best_dt_utc))

            wrote_new_incident = False
            if wrote_new_status:
                # if new status was added then it might be a new incident, try adding the type field to this hash
                wrote_new_incident = rc.hsetnx(name=hash_name, key='type', value=inc_type)
                if wrote_new_incident:
                    # if it's a new incident, then it'll need this other data as well:
                    rc.hset(name=hash_name, key='addr', value=inc_addr)
                    rc.hset(name=hash_name, key='geo',
                            value=f"{inc_geo_lon},{inc_geo_lat}")  # see Redis GEO filter: https://oss.redis.com/redisearch/Commands/#format_2
                    rc.hset(name=hash_name, key='agency', value=inc_agency)

                    # add new geo data to separate sorted set - see: https://redis.io/commands/geoadd
                    rc.geoadd(name="GEO:ROC", values=[inc_geo_lon, inc_geo_lat, inc_id], nx=True)

                stream_data = {
                    'ts': str(best_dt_utc),
                    'id': inc_id,
                    'status': inc_status,
                    'type': inc_type,
                    'addr': inc_addr,
                    'agency': inc_agency,
                    'lat': inc_geo_lat,
                    'lon': inc_geo_lon,
                }
                rc.xadd(name=stream_name, fields=stream_data)

            if wrote_new_incident:
                print(f'\n{ctime_now()}: wrote new incident with hash={hash_name}, key={inc_status}')
                for k, v in incident_dic.items():
                    print(f'{ctime_now()}: key={k}, value={v}')
            elif wrote_new_status:
                print(f'\n{ctime_now()}: added status to incident with hash={hash_name}, key={inc_status}')
                for k, v in incident_dic.items():
                    print(f'{ctime_now()}: key={k}, value={v}')
            # else:
                # print(f'\n{ctime_now()}: no writes needed')

        if debug_mode:
            stream_data = {
                'ts': str(datetime.utcnow()),
                'id': f'TEST{round(time.time())}',
                'status': 'DEBUG',
                'type': 'DEBUG INCIDENT',
                'addr': 'DEBUGGING AVE ROC',
                'agency': 'DBG',
                'lat': f'+43.{str(round(time.time()))[-4:]}',
                'lon': f'-77.{str(round(time.time()))[-4:]}',
            }
            print(f'DEBUG MODE ENABLED - generating debug incident - data={stream_data}')
            rc.xadd(name=stream_name, fields=stream_data)

    except redis.exceptions.ConnectionError as e:
        print(f'{ctime_now()}: ERROR REDIS CONNECTION: {e}')


def ctime_now():
    return datetime.now().ctime()


def main():
    print(f'{ctime_now()}: rss_scraper main()')
    while True:
        rss_to_redis()

        print(f'{ctime_now()}: waiting {delay_sec} seconds..')
        time.sleep(delay_sec)


if __name__ == '__main__':
    print(f'{ctime_now()}: starting rss_to_redis.py')
    main()
