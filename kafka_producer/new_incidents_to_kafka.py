import json
import os
import time

import mysql.connector as con
from kafka import KafkaProducer

# KAFKA PRODUCER
kafka_server = 'kafka_broker:29092'
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

prod = KafkaProducer(bootstrap_servers=kafka_server
                     )


def get_ts():
    return time.strftime("%Y%m%d_%H%M%S")


def get_new_incidents():
    print('getting new incidents from db')
    try:
        uid = None

        last_keepalive_time = False
        while True:
            with con.connect(
                    host=db_host,
                    user=db_user,
                    password=db_pw,
                    database=db_name,
            ) as connection:
                print('db connection established')

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
                    new_records = cursor.fetchall()
                    if new_records:
                        print(f" {get_ts()} - found {len(new_records)} new rows with UID > {uid}")

                        latest_uid = new_records[-1][0]
                        uid = latest_uid

                    else:
                        print(' no new records')

                toc = time.time()
                print(f"\tSELECT query completed in {toc - tic} seconds")

            keepalive_enable = False
            if keepalive_enable:
                if new_records:
                    last_keepalive_time = send_records_to_kafka(prod, new_records)
                else:
                    last_keepalive_time = keepalive(prod, last_keepalive_time)
            else:
                if new_records:
                    send_records_to_kafka(prod, new_records)

            print(f'connection closed - sleeping {new_incident_query_delay_secs} second(s)...\n')
            time.sleep(new_incident_query_delay_secs)

    except con.Error as e:
        print(e)


def send_records_to_kafka(producer, records):
    print(f'{get_ts()} - trying to send {len(records)} records to Kafka')
    for raw_record in records:
        uid, ts, title, published_ts, id_status, id, status, lat, lon = raw_record

        record_strings = [uid, str(ts), title, str(published_ts), id_status, id, status, str(lat), str(lon)]

        json_string = json.dumps(record_strings)

        message = str(json_string)
        print(f'{get_ts()} - Producing message to Kafka:{message}')

        producer.send(kafka_topic, message.encode('ascii'))
    print(f'{get_ts()} - Kafka records sent')
    return time.time()


def keepalive(kafka_prod, last_keepalive_t):
    cadence_s = 30
    attempt_t = time.time()
    if not last_keepalive_t or (attempt_t - last_keepalive_t) > cadence_s:
        return send_keepalive(producer=kafka_prod)
    return last_keepalive_t


def send_keepalive(producer):
    message = 'keepalive'
    print(f'{get_ts()} - Producing message to Kafka:{message}')

    producer.send(kafka_topic, message.encode('ascii'))
    print(f'{get_ts()} - Kafka records sent')
    return time.time()


if __name__ == '__main__':
    print('Starting Kafka Producer')
    get_new_incidents()
