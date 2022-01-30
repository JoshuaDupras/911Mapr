import time

from flask import Flask, render_template, Response
from pykafka import KafkaClient
from pykafka.common import OffsetType


def get_kafka_client():
    return KafkaClient(hosts='kafka_broker:29092')


app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


# Consumer API
@app.route('/topic/<topicname>')  # topic name comes from leaf.js
def get_messages(topicname):
    print(f'getting messages with topicname={topicname}')
    client = get_kafka_client()

    print('got kafka client, processing events now..')

    def events():
        for i in client.topics[topicname].get_simple_consumer(auto_offset_reset=OffsetType.LATEST):
            yield 'data:{0}\n\n'.format(i.value.decode())

    print('returning response')
    return Response(events(), mimetype="text/event-stream")


if __name__ == '__main__':
    print('starting flask app')
    app.run(debug=True, host='0.0.0.0')
