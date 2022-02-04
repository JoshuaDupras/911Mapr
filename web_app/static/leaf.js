var map = L.map('mapid', {
    preferCanvas: true
}).setView([43.1566, -77.6089], 11);

var num_markers = 250

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

mapMarkers = [];

// var source_init = new EventSource('/incidents/get_last/${get_last}'); // KAFKA TOPIC NAME
// var source_live = new EventSource('/topic/live_incidents/live'); // KAFKA TOPIC NAME

window.onload = (event) => {
    console.log('page is fully loaded');
    // fetch_last(10);
    fetch('/test')
        .then(function (response) {
            return response.json();
        }).then(text => {
        console.log('GET response:');
        console.log(text.greeting);
    });

    var index = 33;
    fetch(`/getdata/${index}`)
        .then(response => response.text())
        .then(text => {
            console.log('GET response text:');
            console.log(text);
        });

    var num_incidents = 25;
    fetch(`/incidents/getlast/${num_incidents}`)
        .then(response => response.json())
        .then(data => {
            console.log('GET response text:');
            console.log(data);
            for (const message of data) {
                make_marker('{' + String(message) + '}')  // bit ugly, but we need the correct json string format
            }
        });
};

// function incident_listener_live() {
//     console.log('starting live events consumer');
//     source_live.addEventListener('message', function (e) {
//         console.log('got live event message')
//         get_incident_message(e)
//     }, false);
// }

function make_marker(msg_json) {
    //Needs to be in this form:
    // const json = '{"data":["stuff", "more_stuff", ..etc] }';

    console.log('Making marker from json message:');
    console.log(msg_json);

    console.log('Making marker from message data:');
    let msg_json_parsed = JSON.parse(msg_json);
    console.log(msg_json_parsed)

    console.log('msg_json_parsed.data:')
    let msg = msg_json_parsed.data
    console.log(msg)

    console.log('length:');
    console.log(msg.length);

    console.log('db timestamp:');
    let timestamp = msg[1];
    console.log(timestamp)

    console.log('title:');
    let title = msg[2];
    console.log(title);

    console.log('published time:')
    let published_time = msg[3];
    console.log(published_time);

    console.log('id_status:')
    let id_status = msg[4];
    console.log(id_status);

    console.log('id:')
    let id = msg[5];
    console.log(id);

    console.log('status:')
    let status_label = msg[6];
    console.log(status_label);

    console.log('lat:')
    let lat = msg[msg.length - 2];
    console.log(lat);

    console.log('lon:')
    let lon = msg[msg.length - 1];
    console.log(lon);

    var pulsingIcon = L.icon.pulse({iconSize: [10, 10], color: 'blue'});
    var marker = L.marker([lat, lon], {icon: pulsingIcon}).addTo(map);
    // marker = L.circleMarker([lat, lon], {
    //   color: '#3388ff'
    // }).addTo(map);
    marker_str = 'Title: ' + title + '<br>Time: ' + published_time + '<br>Status: ' + status;
    console.log(marker_str);
    marker.bindPopup(marker_str);
    // marker.openPopup();
    mapMarkers.unshift(marker);
    if (mapMarkers.length > num_markers) {
        map.removeLayer(mapMarkers[(num_markers - 1)]);
        mapMarkers.pop();
    }
    console.log(mapMarkers.length);
    console.log('end message');
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