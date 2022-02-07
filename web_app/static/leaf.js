const max_num_markers = 250;
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

const num_startup_incidents = 3;  // TODO: increase this again
fetch(`/incidents/getlast/${num_startup_incidents}`)
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

            update_markers(json_message_data);
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

        update_markers(message_json_parsed);
    }, false);
}, 3000);

function update_markers(json_record) {
    console.log('got record, updating markers');
    let new_inc = new_incident_from_json(json_record);

    // check if id is in markers yet
    console.log('num mapMarkers=');
    console.log(mapMarkers.length);

    console.log('mapMarkers=');
    console.log(mapMarkers);

    for (const i in mapMarkers) {
        existing_marker = mapMarkers[i];

        // console.log('existing marker=');
        // console.log(existing_marker);

        // console.log('checking if marker IDs are equal (old:' + existing_marker.id + ', new:' + new_inc.id);

        if (existing_marker.id === new_inc.id) {
            // incident ID already exists, update this marker
            // console.log('\tmarkers equal');
            update_marker(i, new_inc);
            return 1;
        }
    }

    console.log('incident not found in mapMarkers, adding now..');
    add_new_incident_to_map(new_inc);
}

function add_new_incident_to_map(new_inc) {

    // new incident ID, make new marker
    let new_incident_marker = {
        id: new_inc.id,
        title: new_inc.title,
        published_ts: new_inc.published_timestamp,
        lat: new_inc.lat,
        lon: new_inc.lon,
        status: []
    };

    let status_obj = {
        db_index: new_inc.db_index,
        db_ts: new_inc.db_timestamp,
        type: new_inc.status
    };
    new_incident_marker.status.unshift(status_obj);

    console.log('generated new_incident_marker:');
    console.log(new_incident_marker);

    // add marker, popup, etc
    new_incident_marker = add_marker_to_incident(new_incident_marker);
    console.log('added marker to incident. updated incident=');
    console.log(new_incident_marker);

    new_incident_marker.marker.openPopup();
    let num_markers = mapMarkers.unshift(new_incident_marker);

    console.log('added incident with marker to list. total markers=');
    console.log(num_markers);

    if (num_markers > max_num_markers) {
        map.removeLayer(mapMarkers[(max_num_markers - 1)]);
        mapMarkers.pop();
    }

    // audioElement.play();  # TODO: enable audio alerts, need toggle button on map as well

    console.log('marker add complete. total markers = ' + mapMarkers.length);

    console.log('marker added -> mapMarkers=');
    console.log(mapMarkers);
}

function add_marker_to_incident(inc) {
    // TODO: marker color based on latest status type

    console.log('adding marker to incident. inc=');
    console.log(inc);

    var pulsingIcon = L.icon.pulse({iconSize: [10, 10], color: 'blue'});
    var marker = L.marker([inc.lat, inc.lon], {icon: pulsingIcon}).addTo(map);

    // non-pulsing marker
    // marker = L.circleMarker([lat, lon], {
    //   color: '#3388ff'
    // }).addTo(map);

    let marker_str = pretty_str_recurse_objects(inc, ['marker']);

    console.log('adding marker with string:');
    console.log(marker_str);
    marker.bindPopup(marker_str);

    inc.marker = marker;

    return inc;
}

function update_marker(existing_marker_index, new_inc) {
    console.log('updating marker with index=' + existing_marker_index);

    let status_obj = {
        db_index: new_inc.db_index,
        db_ts: new_inc.db_timestamp,
        type: new_inc.status
    };
    mapMarkers[existing_marker_index].status.unshift(status_obj);

    console.log('marker with updated status=');
    console.log(mapMarkers[existing_marker_index]);

    console.log('updating marker with string:');
    let marker_str = pretty_str_recurse_objects(mapMarkers[existing_marker_index], ['marker']);
    console.log(marker_str);
    mapMarkers[existing_marker_index].marker.setPopupContent(marker_str);
}

function new_incident_from_json(json_record) {
    // do all fixups here: string, capitalize, etc
    console.log('generating incident from json record');

    console.log('json_record:');
    console.log(json_record);

    const incident = {
        db_index: json_record[0],
        db_timestamp: json_record[1],
        title: json_record[2],
        published_timestamp: json_record[3],
        id: String(json_record[5]).toUpperCase(),
        status: String(json_record[6]).toUpperCase(),
        lat: json_record[7],
        lon: json_record[8]
    };

    console.log('returning incident:');
    console.log(incident);
    return incident;
}

function pretty_str_recurse_objects(obj, stop_recurse_keys = [], tab_spacer = '') {
    let str = '';
    for (const [key, val] of Object.entries(obj)) {
        // console.log(`${tab_spacer}recursive_str_generator: key=${key}, value=${val}`);
        if (val instanceof Object) {
            if (stop_recurse_keys.includes(key)) {
                // console.log(`${tab_spacer}recursive_str_generator: stopping recursion on key=${key}`);
                str += `${tab_spacer}${key}::${val}\n`;
            } else {
                // console.log(`${tab_spacer}recursive_str_generator: object found -> recursing...`);
                str += `${tab_spacer}${key}\n`;
                str += pretty_str_recurse_objects(val, stop_recurse_keys, (tab_spacer + '\t'));
            }
        } else {
            // console.log(`${tab_spacer}recursive_str_generator: not obj -> printing key, value`);
            str += `${tab_spacer}${key}::${val}\n`;
        }
    }
    return str;
}

var lc = L.control.locate({
    position: 'topright',
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

var county_border_geojson_layer = new L.GeoJSON.AJAX("/static/monroe_county.json", {
    style: county_border_style
});
county_border_geojson_layer.addTo(map);