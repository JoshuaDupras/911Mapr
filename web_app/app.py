import logging
import math
from itertools import islice

from flask import Flask, render_template, request, jsonify
from pykafka import KafkaClient
from pykafka.common import OffsetType

logging.basicConfig(level=logging.INFO)


def get_kafka_client():
    return KafkaClient(hosts='kafka_broker:29092')


app = Flask(__name__)


@app.route('/')
def index():
    app.logger.info('index.html called')
    return render_template('index.html')


@app.route('/test', methods=['GET', 'POST'])
def testfn():
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
app.logger.info(data)


######## Data fetch ############
@app.route('/getdata/<index_no>', methods=['GET', 'POST'])
def data_get(index_no):
    app.logger.info(f'data_get({index_no})')
    if request.method == 'POST':  # POST request
        app.logger.info(request.get_text())  # parse as text
        return 'OK', 200

    else:  # GET request
        return 't_in = %s ; result: %s ;' % (index_no, data[int(index_no)])


# Consumer API
@app.route('/incidents/getlast/<num_messages>', methods=['GET'])  # topic name comes from leaf.js
def get_last(num_messages):
    app.logger.info(f'getting last {num_messages} messages"')
    client = get_kafka_client()

    app.logger.info('Kafka client connected')

    def consume_last(n):
        num_msgs = int(n)
        app.logger.info(f'creating consumer and retrieving last {num_msgs} messages')

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
        app.logger.info(f'offsets={offsets}')
        consumer.reset_offsets(offsets)

        message_list = []
        for message in islice(consumer, num_msgs):
            app.logger.info(f'init messages: offset={message.offset}, value={message.value}')
            # message_list.append(message.value.decode())
            message_list.append('"data":{0}'.format(message.value.decode()))
        return jsonify(message_list)

    app.logger.info('returning response')
    return consume_last(num_messages)
    #     app.logger.debug(f'message_list={message_list}')
    #     return jsonify(message_list)
    #
    # app.logger.info('returning response')
    # response = consume_last(num_messages)
    # return response


# @app.route('/topic/<topicname>/live')  # topic name comes from leaf.js
# def get_live_messages(topicname):
#     app.logger.info(f'getting live messages with topic name: "{topicname}"')
#     client = get_kafka_client()
#
#     app.logger.info('got Kafka client, processing events now..')
#
#     def events():
#         for message in client.topics[topicname].get_simple_consumer(auto_offset_reset=OffsetType.LATEST):
#             app.logger.info(f'live messages: offset={message.offset}, value={message.value}')
#             yield 'data:{0}\n\n'.format(message.value.decode())
#
#     app.logger.info('returning response')
#     return Response(events(), mimetype="text/event-stream")

@app.route('/printtest')
def printMsg():
    app.logger.warning('testing warning log')
    app.logger.error('testing error log')
    app.logger.info('testing info log')
    return "Check your console"


if __name__ == '__main__':
    # TODO: switch to production webserver
    app.logger.info('starting flask app')
    app.run(debug=True, host='0.0.0.0')
