import logging
import math
from itertools import islice

from flask import Flask, render_template, request, jsonify, Response
from pykafka import KafkaClient
from pykafka.common import OffsetType

logging.basicConfig(level=logging.DEBUG, format='{asctime} | {levelname:^8} | {name}.{lineno} : {message}', style='{')


def get_kafka_client():
    return KafkaClient(hosts='kafka_broker:29092')


app = Flask(__name__)


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


# Consumer API
@app.route('/incidents/getlast/<num_messages>', methods=['GET'])  # topic name comes from leaf.js
def get_last(num_messages):
    # TODO: input checking on num_messages, int, limit range

    app.logger.info(f'{request.remote_addr}:getting last {num_messages} messages"')
    client = get_kafka_client()

    app.logger.info(f'{request.remote_addr}:Kafka client connected')

    def consume_last(n):
        num_msgs = int(n)
        app.logger.info(f'{request.remote_addr}:creating consumer and retrieving last {num_msgs} messages')

        # TODO: pretty sure consumer hangs if no messages found
        consumer = client.topics['live_incidents'].get_simple_consumer(auto_offset_reset=OffsetType.LATEST,
                                                                       reset_offset_on_start=True)
        # how many messages should we get from the end of each partition?
        max_partition_rewind = int(math.ceil(num_msgs / len(consumer._partitions)))
        # find the beginning of the range we care about for each partition
        offsets = [(p, op.last_offset_consumed - max_partition_rewind)
                   for p, op in consumer._partitions.items()]
        # if we want to rewind before the beginning of the partition, limit to beginning
        offsets = [(p, (o if o > -1 else -2)) for p, o in offsets]
        # reset the consumer's offsets
        app.logger.info(f'{request.remote_addr}:offsets={offsets}')
        consumer.reset_offsets(offsets)

        message_list = []
        for message in islice(consumer, num_msgs):
            app.logger.info(f'{request.remote_addr}:init messages: offset={message.offset}, value={message.value}')
            # message_list.append(message.value.decode())
            message_list.append('"data":{0}'.format(message.value.decode()))
        return jsonify(message_list)

    app.logger.info(f'{request.remote_addr}:returning response')
    return consume_last(num_messages)


# Consumer API
disable_live_stream = False
@app.route('/incidents/live')  # topic name comes from leaf.js
def get_messages(topicname='live_incidents'):
    if disable_live_stream:
        app.logger.warning('live event stream disabled by flask backend')
        return 0

    app.logger.info(f'getting messages with topic name={topicname}')
    client = get_kafka_client()

    app.logger.info('got Kafka client, processing events now..')

    def events():
        for i in client.topics[topicname].get_simple_consumer(auto_offset_reset=OffsetType.LATEST,
                                                              reset_offset_on_start=True):
            yield 'data:{0}\n\n'.format(i.value.decode())

    app.logger.info('returning response')
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
