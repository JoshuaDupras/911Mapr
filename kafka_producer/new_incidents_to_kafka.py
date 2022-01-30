import json
import os
import time

import mysql.connector as con
from pykafka import KafkaClient

# KAFKA PRODUCER
kafka_hostname = 'kafka_broker'
kafka_port = 29092
kafka_topic = 'live_incidents'

starting_row_uid = 0

db_host = os.getenv('MYSQL_HOST')
db_name = os.getenv('MYSQL_DATABASE')
db_table_name = os.getenv('MYSQL_TABLE')

db_user = os.getenv('MYSQL_USER')
print(f'db_user={db_user}')

db_pw = os.getenv('MYSQL_PASSWORD')
if db_pw is None:
    raise ValueError('Password Environment Variable not found!')
# print(f'db_pw={db_pw}')

new_incident_query_delay_secs = 1


def get_ts():
    return time.strftime("%Y%m%d_%H%M%S")


def get_new_incidents():
    print('getting new incidents from db')
    try:
        uid = None

        while True:
            with con.connect(
                    host=db_host,
                    user=db_user,
                    password=db_pw,
                    database=db_name,
            ) as connection:
                print('connection established')

                tic = time.time()
                with connection.cursor() as cursor:
                    if not uid:
                        last_row_query = f'select *from {db_table_name} ORDER BY uid DESC LIMIT 1;'
                        cursor.execute(last_row_query)
                        last_record = cursor.fetchone()
                        uid = last_record[0]

                    print(f"\tselecting entries with UID > {uid}...", end='')
                    select_query = f"SELECT * FROM {db_table_name} where uid > {uid}"

                    cursor.execute(select_query)
                    records = cursor.fetchall()
                    if records:
                        print(f" {get_ts()} - found {len(records)} new rows with UID > {uid}")

                        latest_uid = records[-1][0]
                        uid = latest_uid
                    else:
                        print(' no new records')

                toc = time.time()
                print(f"\tSELECT query completed in {toc - tic} seconds")

            if records:
                send_records_to_kafka(records)

            print(f'connection closed - sleeping {new_incident_query_delay_secs} second(s)...\n')
            time.sleep(new_incident_query_delay_secs)

    except con.Error as e:
        print(e)


def send_records_to_kafka(records):
    client = KafkaClient(hosts=f"{kafka_hostname}:{kafka_port}")
    topic = client.topics[kafka_topic]
    producer = topic.get_sync_producer()

    print(f'{get_ts()} - trying to send {len(records)} records to kafka')
    for raw_record in records:

        uid, ts, title, published_ts, id_status, id, status, lat, lon = raw_record

        record_strings = [uid, str(ts), title, str(published_ts), id_status, id, status, str(lat), str(lon)]

        json_string = json.dumps(record_strings)

        message = str(json_string)
        producer.produce(message.encode('ascii'))
    print(f'{get_ts()} - kafka records sent')


if __name__ == '__main__':
    print('starting kafka producer')
    get_new_incidents()
