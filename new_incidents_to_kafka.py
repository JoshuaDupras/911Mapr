import json
import os
import time

import winsound

import mysql.connector as con
from pykafka import KafkaClient

from dotenv import load_dotenv
load_dotenv()

# KAFKA PRODUCER
client = KafkaClient(hosts="localhost:9092")
topic = client.topics['live_incidents_2h_test']
producer = topic.get_sync_producer()

starting_row_uid = 0

host = "localhost"
db_name = "911_incidents"
table_name = 'incidents'

db_user = os.getenv('db_user')
db_pw = os.getenv('db_pass')

new_incident_query_delay = 3

def get_ts():
    return time.strftime("%Y%m%d_%H%M%S")

def get_new_incidents():
    print('getting new incidents')
    try:
        uid = starting_row_uid

        while True:
            print(f'{get_ts()} - connecting and getting records from db with UID > {uid}')

            records = []

            with con.connect(
                    host=host,
                    user=db_user,
                    password=db_pw,
                    database=db_name,
            ) as connection:
                print('connection established')

                tic = time.time()
                with connection.cursor() as cursor:
                    select_query = f"SELECT * FROM {table_name} where uid > {uid}"

                    cursor.execute(select_query)
                    records = cursor.fetchall()
                    if records:
                        print(f"{get_ts()} - found {len(records)} new rows with UID > {uid}")

                        latest_uid = records[-1][0]
                        uid = latest_uid

                toc = time.time()
                print(f"SELECT query completed in {toc-tic} seconds")

            if records:
                send_records_to_kafka(records)

            print('connection closed.. sleeping\n')
            time.sleep(new_incident_query_delay)

    except con.Error as e:
        print(e)


def send_records_to_kafka(records):
    print(f'{get_ts()} - sending {len(records)} records to kafka')
    for raw_record in records:
        winsound.Beep(440, 500)

        lat = raw_record[-2]
        lon = raw_record[-1]

        uid, ts, title, published_ts, id_status, id, status, lat, lon = raw_record

        record_strings = [uid, str(ts), title, str(published_ts), id_status, id, status, str(lat), str(lon)]

        jsonString = json.dumps(record_strings)

        message = str(jsonString)
        producer.produce(message.encode('ascii'))
    print(f'{get_ts()} - kafka records sent')

if __name__ == '__main__':
    get_new_incidents()
