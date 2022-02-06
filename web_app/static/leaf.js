const num_markers = 250;
var mapMarkers = [];

var audioElement = new Audio();
audioElement.src = "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA+...";

var map = L.map('map', {
    preferCanvas: true
}).setView([43.1566, -77.6089], 11);

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
//    maxZoom: 18,
//    minZoom: 11,
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: 'pk.eyJ1Ijoiam9zaHVhZHVwcmFzIiwiYSI6ImNreDR5enZ2ejI2NWsydnEzMHpiMGQzaTkifQ.1H9rEa9GIAO5ly-aBXkY9g' //ENTER YOUR ACCESS TOKEN HERE
}).addTo(map);

//map.fitBounds([
//    [43.4, -78.00],
//    [42.9, -77.00]
//]);

window.onload = (event) => {
    console.log('page is fully loaded');
    // fetch_last(10);
};

fetch('/test')
    .then(function (response) {
        return response.json();
    }).then(text => {
    console.log('GET response - greeting::');
    console.log(text.greeting);
});

const index = 33;
fetch(`/getdata/${index}`)
    .then(response => response.text())
    .then(text => {
        console.log('GET response text:');
        console.log(text);
    });

const num_incidents = 25;
fetch(`/incidents/getlast/${num_incidents}`)
    .then(response => response.json())
    .then(response => {
        console.log('getlast response text:');
        console.log(response);
        for (const message of response) {
            console.log('single message:');
            console.log(message);

            console.log('single message in json format:');
            let json_message = '{' + String(message) + '}';
            console.log(json_message);

            console.log('json parsed message:');
            let message_json_parsed = JSON.parse(json_message);
            console.log(message_json_parsed);

            console.log('json_message_data');
            let json_message_data = message_json_parsed.data;
            console.log(json_message_data);

            make_marker(json_message_data);
        }
    });


setTimeout(() => {
    console.log('starting live events listener');
    var source_live = new EventSource('/incidents/live');
    source_live.addEventListener('message', function (e) {
        console.log('got live event message:');
        console.log(e);

        console.log('live event message data:');
        console.log(e.data);

        console.log('e.data json parsed:');
        let message_json_parsed = JSON.parse(e.data);
        console.log(message_json_parsed);

        make_marker(message_json_parsed);
    }, false);
}, 3000);

function make_marker(json_record) {
    // event message needs to be in this form:
    // msg_json = '{"data":["stuff", "more_stuff", ..etc] }';

    console.log('Making marker');

    console.log('json_record:');
    console.log(json_record);

    // console.log('record_json_parsed:');
    // let record_json_parsed = JSON.parse(raw_record);
    // console.log(record_json_parsed);

    // console.log('msg_json_parsed.data:');
    // let record = record_json_parsed.data;
    // console.log(record);

    // console.log('length:');
    // console.log(msg.length);

    // console.log('db index:');
    let db_timestamp = json_record[0];
    // console.log(db_timestamp);

    // console.log('db timestamp:');
    let timestamp = json_record[1];
    // console.log(timestamp);

    // console.log('title:');
    let title = json_record[2];
    // console.log(title);

    // console.log('published time:');
    let published_time = json_record[3];
    // console.log(published_time);

    // console.log('id_status:');
    let id_status = json_record[4];
    // console.log(id_status);

    // console.log('id:');
    let id = json_record[5];
    // console.log(id);

    // console.log('status:');
    let status_label = json_record[6];
    // console.log(status_label);

    // console.log('lat:');
    let lat = json_record[json_record.length - 2];
    // console.log(lat);

    // console.log('lon:');
    let lon = json_record[json_record.length - 1];
    // console.log(lon);

    var pulsingIcon = L.icon.pulse({iconSize: [10, 10], color: 'blue'});
    var marker = L.marker([lat, lon], {icon: pulsingIcon}).addTo(map);
    // marker = L.circleMarker([lat, lon], {
    //   color: '#3388ff'
    // }).addTo(map);
    marker_str = 'Title: ' + title + '<br>Time: ' + published_time + '<br>Status: ' + status;

    console.log('adding marking with string:');
    console.log(marker_str);
    marker.bindPopup(marker_str);
    marker.openPopup();
    mapMarkers.unshift(marker);
    if (mapMarkers.length > num_markers) {
        map.removeLayer(mapMarkers[(num_markers - 1)]);
        mapMarkers.pop();
    }

    audioElement.play();

    console.log('marker add complete. total markers = ' + mapMarkers.length);
}

var lc = L.control.locate({
    position: 'topleft',
    strings: {
        title: "Show me where I am, yo!"
    }
}).addTo(map);

// coordinates limiting the map
function getBounds() {
    const southWest = new L.LatLng(42.70, -78.44);
    const northEast = new L.LatLng(43.50, -77.10);
    return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(map.getBounds());

// zoom the map to the polyline
map.fitBounds(getBounds(), {reset: true});

var county_border_style = {
    "color": "#ff0000",
    "weight": 3,
    "opacity": 0.6,
    "fill": false,
    "dashArray": "10"
};

var geojsonLayer = new L.GeoJSON.AJAX("/static/monroe_county.json", {
    style: county_border_style
});
geojsonLayer.addTo(map);