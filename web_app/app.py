import logging
import re
import time
from datetime import datetime

from flask import Flask, render_template, request, jsonify, Response
from kafka import KafkaConsumer, TopicPartition

logging.basicConfig(level=logging.INFO, format='{asctime} | {levelname:^8} | {name}.{lineno} : {message}', style='{')

app = Flask(__name__)

incidents_topic = 'live_incidents'
kafka_server = 'kafka_broker:29092'
partition_num = 0


def get_consumer():
    app.logger.info(f'Creating Kafka Consumer and connecting to broker...')
    consumer = KafkaConsumer(incidents_topic,
                             bootstrap_servers=kafka_server,
                             enable_auto_commit=True,  # TODO:test this on/off
                             # value_deserializer = lambda m: json.loads(m.decode('utf-8'))  # TODO: inline deserialization
                             )
    app.logger.info(f'Kafka Consumer connected to Broker')
    return consumer


@app.route('/')
def index():
    app.logger.info(f'{request.remote_addr}:index.html called')
    return render_template('index.html')


@app.route('/test', methods=['GET', 'POST'])
def testfn():
    app.logger.info(f'{request.remote_addr}: /test')
    # GET request
    if request.method == 'GET':
        message = {'greeting': 'Hello from Flask!'}
        return jsonify(message)  # serialize and use JSON headers
    # POST request
    if request.method == 'POST':
        app.logger.info(request.get_json())  # parse as JSON
        return 'Sucesss', 200


######## Example data, in sets of 3 ############
data = list(range(1, 300, 3))


# app.logger.info(data)


######## Data fetch ############
@app.route('/getdata/<index_no>', methods=['GET', 'POST'])
def data_get(index_no):
    app.logger.info(f'{request.remote_addr}:data_get({index_no})')
    if request.method == 'POST':  # POST request
        app.logger.info(request.get_text())  # parse as text
        return 'OK', 200

    else:  # GET request
        return 't_in = %s ; result: %s ;' % (index_no, data[int(index_no)])


@app.route('/incidents/range/<time_range_str_start>_<time_range_str_end>', methods=['GET'])
def get_time_range(time_range_str_start, time_range_str_end):
    request_start_ts = time.time()
    start_dt = process_time_range_str(time_range_str_start)
    end_dt = process_time_range_str(time_range_str_end)
    messages = consume_time_range(start_dt, end_dt)
    app.logger.info(f'retrieved {len(messages)} messages in {time.time() - request_start_ts} seconds')
    return jsonify(messages)


@app.route('/incidents/since/<time_range_str>', methods=['GET'])
def get_since(time_range_str):
    request_start_ts = time.time()
    start_dt = process_time_range_str(time_range_str)
    end_dt = datetime.now()
    messages = consume_time_range(start_dt, end_dt)
    app.logger.info(f'retrieved {len(messages)} messages in {time.time() - request_start_ts} seconds')
    return jsonify(messages)


def now_ms():
    return time.time() * 1000


def consume_time_range(start_dt, end_dt):
    func_start_ts = time.time()
    start_ms = start_dt.timestamp() * 1000
    end_ms = end_dt.timestamp() * 1000
    app.logger.info(f"consuming from time range: date_start_ms={start_ms}, date_end_ms={end_ms}")
    app.logger.info(f'current time = {datetime.now().ctime()}')

    c = get_consumer()  # doesn't do any consuming, only metadata
    tp = TopicPartition(incidents_topic, partition_num)  # partition n. 0

    start_offset = offsets_for_times(c, [tp], start_ms)[tp]
    app.logger.info(f'start offsets={start_offset}')
    end_offset = offsets_for_times(c, [tp], end_ms)[tp] - 1
    app.logger.info(f'end offsets={end_offset}')
    app.logger.info(f'start offsets={start_offset}, end offsets={end_offset}')

    if start_offset == end_offset:
        return []

    c.seek(tp, start_offset)

    app.logger.info(f'consuming between offsets {start_offset} and {end_offset}')
    msg_list = []
    msg_index = -1
    for msg in c:
        app.logger.info(f'got msg with offset={msg.offset}')
        if msg.offset >= end_offset:
            app.logger.info(f'msg offset ({msg.offset}) is greater or equal to end offset ({end_offset}), breaking...')
            break
        msg_index += 1
        app.logger.info(f'msg_index={msg_index}, msg_offset={msg.offset}, msg_value={msg.value}')
        decoded_msg = msg.value.decode()
        app.logger.info('msg decoded')
        msg_list.append('"data":{0}'.format(decoded_msg))
        app.logger.info('msg appended to msg_list')
    app.logger.info(f'consumed {len(msg_list)} messages between "{start_dt.ctime()}" and "{end_dt.ctime()} in '
                     f'{time.time() - func_start_ts} seconds"')

    app.logger.info('closing consumer')
    c.close()
    app.logger.info('consumer closed. returning msg_list..')
    return msg_list


def offsets_for_times(consumer, partitions, timestamp_ms):
    """Augment KafkaConsumer.offsets_for_times to not return None

    Parameters
    ----------
    consumer : kafka.KafkaConsumer
        This consumer must only be used for collecting metadata, and not
        consuming. API's will be used that invalidate consuming.
    partitions : list of kafka.TopicPartition
    timestamp_ms : number
        Timestamp, in seconds since unix epoch, to return offsets for.

    Returns
    -------
    dict from kafka.TopicPartition to integer offset
    """
    # Kafka uses millisecond timestamps
    response = consumer.offsets_for_times({p: timestamp_ms for p in partitions})
    offsets = {}
    for tp, offset_and_timestamp in response.items():
        if offset_and_timestamp is None:
            app.logger.warning(f'offset_and_timestamp is None, timestamp_ms={timestamp_ms}')
            # No messages exist after timestamp. Fetch latest offset.
            # consumer.assign([tp])
            consumer.seek_to_end(tp)
            offsets[tp] = consumer.position(tp)
        else:
            offsets[tp] = offset_and_timestamp.offset
    app.logger.info(f'getting offsets: timestamp_ms={timestamp_ms}, offsets={offsets}')
    return offsets


def process_time_range_str(time_range_str):
    # time range should be in the format:
    # "2022-03-01-00:50_2022-03-05-12:22"
    reg_exp = re.compile(r'(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})')
    match = reg_exp.match(time_range_str)
    if not match:
        raise ValueError(
            f'Invalid time_range_str. Expected format = "YYYY-MM-DD-HR:MN_YYYY-MM-DD-HR:MN" ("start_end"), '
            f'but received "{time_range_str}"')
    (yyyy, mm, dd, hr, min) = tuple(map(int, match.groups()))
    dt = datetime(yyyy, mm, dd, hr, min)
    app.logger.info(f'processing complete on time_range_str: "{time_range_str}" = "{dt.ctime()}"')
    return dt


# Consumer API
disable_live_stream = False
@app.route('/incidents/live')
def incident_stream():
    if disable_live_stream:
        app.logger.warning('live event stream disabled by flask backend')
        return 'disabled'

    consumer = get_consumer()
    tp = TopicPartition(incidents_topic, partition_num)  # partition n. 0

    # consumer.seek_to_end(tp)

    ignore_list = ['keepalive']  # TODO: re-enable
    # ignore_list = None  # TODO: remove debug list

    def events():
        app.logger.info('starting kafka live consumer loop')
        last_msg_ts = None
        poll_delay_s = 5  # TODO: drop this to 0.5 in prod
        heartbeat_cadence_s = 30  # TODO: this could probably be 30 or more

        last_msg_ts = None
        while True:
            app.logger.info(f'top of while True loop, delaying consumer poll by {poll_delay_s} seconds')
            time.sleep(poll_delay_s)

            poll_response = consumer.poll()
            if poll_response == {}:
                pass
            else:
                # consumed a record, let's make sure it's valid
                app.logger.info(f'poll_response={poll_response}')

                record = poll_response[tp][0]
                app.logger.info(f'record={record}')

                msg = record.value.decode()
                app.logger.info(f'msg={msg}')

                if msg in ignore_list:
                    app.logger.warning(f'ignoring msg={msg}')
                else:
                    #  got a valid message, yield it
                    offset = record.offset
                    app.logger.info(f'offset={offset}')

                    response = 'data:{0}\n\n'.format(msg)
                    app.logger.info(f'yielding response = {response}')
                    yield response
                    last_msg_ts = time.time()
                    continue

            if last_msg_ts is None or time.time() - last_msg_ts > heartbeat_cadence_s:
                app.logger.info(f'heartbeat cadence exceeded ({heartbeat_cadence_s} seconds) - yielding heartbeat')
                yield 'data:{0}\n\n'.format('heartbeat')
                last_msg_ts = time.time()

            app.logger.info('bottom of while True loop')

    return Response(events(), mimetype="text/event-stream")


@app.route('/printtest')
def printMsg():
    app.logger.error(f'{request.remote_addr}:testing error log')
    app.logger.warning(f'{request.remote_addr}:testing warning log')
    app.logger.error(f'{request.remote_addr}:testing error log')
    app.logger.info(f'{request.remote_addr}:testing info log')
    return "printtest complete -> Check backend log"


if __name__ == '__main__':
    # TODO: switch to production webserver
    app.logger.info('starting flask app')
    app.debug = True
    app.run(threaded=True, host='0.0.0.0')
