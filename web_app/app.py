import json
import logging
import re
import time
from datetime import datetime, timedelta
from os import environ

from flask import Flask, render_template, request, jsonify, Response
from redis import Redis

logging.basicConfig(level=logging.INFO, format='{asctime} | {levelname:^8} | {name}.{lineno} : {message}', style='{')

app = Flask(__name__)

stream_key = environ.get("STREAM", "S:ROC")


def connect_to_redis():
    return Redis(host=environ.get("REDIS_HOST", "localhost"),
                 port=environ.get("REDIS_PORT", 6379),
                 password=environ.get("REDIS_PASSWORD"),
                 retry_on_timeout=True,
                 decode_responses=True)


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
    app.logger.info(f'retrieving incidents that occurred after {time_range_str}')
    request_start_ts = time.time()
    start_dt = process_time_range_str(time_range_str)
    end_dt = datetime.now()
    messages = consume_time_range(start_dt, end_dt)
    app.logger.info(f'retrieved {len(messages)} messages in {time.time() - request_start_ts} seconds')
    return jsonify(messages)


@app.route('/incidents/init', methods=['GET'])
def initial_fetch():
    fetch_hours = 3
    json_msgs, live_start_id = past_hours(fetch_hours)
    app.logger.info(f'init fetch complete - live_start_id={live_start_id}')
    return json_msgs


@app.route('/incidents/past/hours/<hours>', methods=['GET'])
def past_hours(hours):
    app.logger.info(f'retrieving incidents from the last {hours} hours')
    request_start_ts = time.time()
    start_dt = datetime.now() - timedelta(hours=int(hours))
    end_dt = datetime.now()
    messages, last_id_consumed = consume_time_range(start_dt, end_dt)
    app.logger.info(f'retrieved {len(messages)} messages in {time.time() - request_start_ts} seconds')
    return jsonify(messages), last_id_consumed


@app.route('/incidents/past/days/<days>', methods=['GET'])
def past_days(days):
    app.logger.info(f'retrieving incidents from the last {days} days')
    json_msgs, last_id = past_hours(int(days) * 24)
    return json_msgs


def now_ms():
    return time.time() * 1000


def consume_time_range(start_dt, end_dt):
    func_start_ts = time.time()
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)
    app.logger.info(f"consuming from time range: date_start_ms={start_ms}, date_end_ms={end_ms}")
    app.logger.info(f'current time = {datetime.now().ctime()}')

    r = connect_to_redis()
    stream_info = r.xinfo_stream(name=stream_key)
    app.logger.info(f'stream_info={stream_info}')
    last_id = stream_info['last-generated-id']
    app.logger.info(f'last ID = {last_id}')

    records = r.xrange(name=stream_key, min=f'{start_ms}-0', max=f'{end_ms}-0')
    app.logger.info(f'xrange from {start_ms} to {end_ms} - records={records}')

    msg_list = []
    last_id = None
    for record in records:
        app.logger.info(f'got record={record}')

        last_id, msg_data = record
        app.logger.info(f"REDIS ID: {last_id}")
        app.logger.info(f"DATA = {msg_data}")

        msg_dict = {'data': msg_data}
        msg_list.append(msg_dict)
        app.logger.info('record appended to msg_list')
    app.logger.info(f'read {len(msg_list)} records between "{start_dt.ctime()}" and "{end_dt.ctime()} in '
                    f'{time.time() - func_start_ts} seconds"')

    r.close()
    return msg_list, last_id


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

    r = connect_to_redis()

    ignore_list = ['keepalive']  # TODO: re-enable

    def events():
        app.logger.info('starting live xread loop')
        last_msg_ts = None
        poll_delay_s = 5  # TODO: drop this to 0.5 in prod
        heartbeat_cadence_s = 30  # TODO: this could probably be 30 or more

        last_msg_ts = None

        stream_info = r.xinfo_stream(name=stream_key)
        app.logger.info(f'stream_info={stream_info}')

        # TODO: use last ID from init request as start of live eventStream, so we don't miss any incidents in between

        last_id = stream_info['last-generated-id']
        app.logger.info(f'last ID = {last_id}')

        while True:
            app.logger.info(f'top of while True loop, delaying consumer poll by {poll_delay_s} seconds')
            time.sleep(poll_delay_s)

            resp_list = r.xread(streams={stream_key: last_id}, count=1, block=5000)

            app.logger.info(f'read from redis with ID={last_id} - response of length {len(resp_list)}="{resp_list}"')

            if resp_list:
                resp_0 = resp_list[0]
                app.logger.info(f'resp = "{resp_0}"')

                key, messages = resp_0
                last_id, data = messages[0]
                app.logger.info(f"REDIS ID: {last_id}")
                app.logger.info(f"DATA = {data}")

                # json_data = jsonify(data)
                # app.logger.info(json_data)

                data = json.dumps(data)
                yield_this = 'data:{0}\n\n'.format(data)
                app.logger.info(f'yielding:"{yield_this}"')

                yield yield_this
                last_msg_ts = time.time()
                continue

            if last_msg_ts is None or time.time() - last_msg_ts > heartbeat_cadence_s:
                app.logger.info(f'heartbeat cadence exceeded ({heartbeat_cadence_s} seconds) - yielding heartbeat')
                yield f'data:{{"heartbeat": "{round(time.time())}"}}\n\n'
                last_msg_ts = time.time()

            app.logger.info('bottom of while True loop')

    r.close()
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
