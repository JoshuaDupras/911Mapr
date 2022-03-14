import os
import time

import feedparser
import mysql.connector

delay_sec = 10

# printing environment variables
print(f'environment variables:\n{os.environ}')

db_host = os.getenv('MYSQL_HOST')
print(f'db_host={db_host}')

db_port = int(os.getenv('MYSQL_PORT'))
print(f'db_port={db_port}')

db_name = os.getenv('MYSQL_DATABASE')
print(f'db_name={db_name}')

db_table_name = os.getenv('MYSQL_TABLE')
print(f'db_table_name={db_table_name}')

db_user = os.getenv('MYSQL_USER')
print(f'db_user={db_user}')

db_pw = os.getenv('MYSQL_PASSWORD')
if db_pw is None:
    raise ValueError('Password Environment Variable not found!')


# print(f'db_pw={db_pw}')


def get_ts():
    return time.strftime("%Y%m%d_%H%M%S")


def send_incident_to_mysql(conn, record):
    # print(f"inserting record:{record}")

    insert_product_query = f"""
        INSERT IGNORE INTO {db_table_name}
            (title, published, inc_id_status, inc_id, status, geo_lat, geo_lon)
            VALUES ( %s, %s, %s, %s, %s, %s, %s )
        """

    update_timestamp_query = f"""
                ALTER TABLE {db_table_name} AUTO_INCREMENT=1;
            """

    with conn.cursor() as cursor:
        cursor.execute(insert_product_query, record)
        cursor.execute(update_timestamp_query)
        conn.commit()


def get_published_ts(raw_published, raw_published_parsed):
    # print("getting mysqql TIMESTAMP from published entries")
    # print(f"raw_published={raw_published}")
    # print(f'raw_published_parsed={raw_published_parsed}')

    hh_mm_ss = raw_published.split()[4]
    yyyy = str(raw_published_parsed[0])
    mm = str(raw_published_parsed[1])
    if len(mm) == 1:
        mm = '0' + mm
    dd = str(raw_published_parsed[2])
    if len(dd) == 1:
        dd = '0' + dd

    ts = f'{yyyy}-{mm}-{dd} {hh_mm_ss}'
    ts_len = len(ts)
    if ts_len != 19:
        raise ValueError(f"Invalid mysql TIMESTAMP generated, length is not = 19 (len = {ts_len}")

    return ts


def parse_feed(url='https://www.monroecounty.gov/911/rss.php'):
    print(f'{get_ts()}: connecting to RSS feed and scraping incidents')
    news_feed = feedparser.parse(url)
    print(f'{get_ts()}: scraping complete')
    return news_feed


def rss_to_mysql():
    print(f'{get_ts()}: rss_to_mysql()')
    try:
        rss_feed = parse_feed()

        print(f'{get_ts()}: attempting MySQL connection')
        with mysql.connector.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_pw,
                database=db_name,
        ) as connection:
            print(f'{get_ts()}: mysql connected - connection:{connection}')
            entries = rss_feed.entries
            print(f'{get_ts()}: found {len(entries)} incidents - blindly pushing them to database')
            for incident_dic in entries:
                # print('\n\n******************************************')
                # print(f'    {time.strftime("%Y%m%d_%H%M%S")} - {incident_dic}')

                # for k, v in incident_dic.items():
                # print(f'key={k}, value={v}')

                title = incident_dic['title']
                raw_published = incident_dic['published']
                raw_published_parsed = incident_dic['published_parsed']
                status = incident_dic['summary'].split(',')[0].split()[1]
                inc_id = incident_dic['summary'].split(',')[1].split()[1]
                geo_lat = incident_dic['geo_lat']
                geo_lon = incident_dic['geo_long']

                inc_id_status = f'{inc_id}_{status}'

                published_ts = get_published_ts(raw_published, raw_published_parsed)

                record = (title, published_ts, inc_id_status, inc_id, status, geo_lat, geo_lon)

                send_incident_to_mysql(connection, record)
            print(f'{get_ts()}: push complete, closing connection...')

        print(f'{get_ts()} mysql disconnected')

    except mysql.connector.Error as e:
        print(f'{get_ts()}: MySQL connection error: {e}')


def main():
    print(f'{get_ts()}: rss_scraper main()')
    while True:
        rss_to_mysql()
        time.sleep(delay_sec)


if __name__ == '__main__':
    print(f'{get_ts()}: starting rss_to_mysql.py')
    main()
