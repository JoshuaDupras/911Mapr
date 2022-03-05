const max_num_markers = 250;
var mapMarkers = [];

var map = L.map('map', {
    preferCanvas: true,
    minZoom: 9,
    maxZoom: 18
});
map.setView([43.1575, -77.6808], 10);
map.zoomControl.setPosition('bottomright');

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/dark-v10',
    accessToken: 'pk.eyJ1Ijoiam9zaHVhZHVwcmFzIiwiYSI6ImNreDR5enZ2ejI2NWsydnEzMHpiMGQzaTkifQ.1H9rEa9GIAO5ly-aBXkY9g' //ENTER YOUR ACCESS TOKEN HERE
}).addTo(map);

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

// TODO: implement last <hours/days> fetch, don't hardcode date/time
time_str = '2022-03-01-00:00'
fetch(`/incidents/since/${time_str}`)
    .then(response => response.json())
    .then(response => {
        console.log('since response text:');
        console.log(response);
        for (const message of response) {
            console.log('single message:' + message);

            let json_message = '{' + String(message) + '}';
            console.log('single message in json format:' + json_message);

            let message_json_parsed = JSON.parse(json_message);
            console.log('json parsed message:' + message_json_parsed);

            let json_message_data = message_json_parsed.data;
            console.log('json_message_data' + json_message_data);

            update_markers(json_message_data);
        }
    });


const live_source_delay_ms = 2500;
setTimeout(() => {
    console.log('starting live events listener');
    var source_live = new EventSource('/incidents/live');
    source_live.addEventListener('message', function (e) {
        console.log('got live event message:' + e);
        console.log('live event message data:' + e.data);

        if (e.data === 'heartbeat') {
            console.log('got heartbeat');
        } else {
            let message_json_parsed = JSON.parse(e.data);
            console.log('e.data json parsed:' + message_json_parsed);

            update_markers(message_json_parsed);
        }
    }, false);
}, live_source_delay_ms);

function update_markers(json_record) {
    console.log('got record, updating markers');
    let new_inc = new_incident_from_json(json_record);

    // check if id is in markers yet
    console.log('num mapMarkers=' + mapMarkers.length);

    console.log('mapMarkers=');
    console.log(mapMarkers);

    for (const i in mapMarkers) {
        existing_marker = mapMarkers[i];

        // console.log('checking if marker IDs are equal (old:' + existing_marker.id + ', new:' + new_inc.id);

        if (existing_marker.id === new_inc.id) {
            // incident ID already exists, update this marker
            // console.log('\tmarkers equal');
            update_marker(i, new_inc);
            return 1;
        }
    }

    console.log('incident not found in mapMarkers, adding now..');
    add_new_incident_to_map(new_inc);  // adds incident to mapMarkers
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
    new_incident_marker.status.unshift(status_obj);  // add status to incident

    console.log('generated new_incident_marker:');
    console.log(new_incident_marker);

    // add marker, popup, etc
    new_incident_marker = add_marker_to_incident(new_incident_marker);
    console.log('added marker to incident. updated incident=');
    console.log(new_incident_marker);

    // new_incident_marker.marker.openPopup();
    let num_markers = mapMarkers.push(new_incident_marker);

    console.log('added incident with marker to mapMarkers.');

    if (num_markers > max_num_markers) {
        console.log('reached maximum number of markers (' + max_num_markers + '), removing the earliest.')
        map.removeLayer(mapMarkers[(max_num_markers - 1)]);
        mapMarkers.pop();
    }

    console.log('marker add complete. total markers = ' + mapMarkers.length);
    let index = mapMarkers.length - 1;
    console.log('new incident index = ' + index);

    console.log('marker added -> mapMarkers=');
    console.log(mapMarkers);

    console.log('adding incident to incident table');
    add_incident_to_sidebar_list(index);
    play_alert();
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
    position: 'bottomright',
    strings: {
        title: "Show me where I am, yo!"
    }
}).addTo(map);

// coordinates limiting the map
function getBounds() {
    const southWest = new L.LatLng(42.80, -78.10);
    const northEast = new L.LatLng(43.50, -77.30);
    return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(getBounds());

// zoom the map to the polyline
// map.fitBounds(getBounds(), {reset: true});

var county_border_style = {
    "color": "rgba(255,0,30,0.36)",
    "weight": 3,
    "opacity": 0.6,
    "fill": false,
    "dashArray": "10"
};

var county_border_geojson_layer = new L.GeoJSON.AJAX("/static/monroe_county.json", {
    style: county_border_style
});
county_border_geojson_layer.addTo(map);

function toggle_sidebar() {
    var sb_c = document.getElementById("sidebarTest");
    var map_c = document.getElementById("mapTest");
    if (sb_c.style.display === "none") {
        sb_c.style.display = "block";
        if (document.body.clientWidth < 575) {
            map_c.style.height = "auto";
        }
    } else {
        sb_c.style.display = "none";
        if (document.body.clientWidth < 575) {
            map_c.style.height = "100%";
        }
    }
}


// document.getElementById('sidebarContents').innerHTML = '<ol><li>html data</li></ol>';

function incTable_addRow(published, title, id) {
    // Get a reference to the table
    let tableID = 'inc_tbody';
    let tableRef = document.getElementById(tableID);

    // Insert a row at the end of the table
    let newRow = tableRef.insertRow(0);

    // Insert a cell in the row at index 0
    let published_cell = newRow.insertCell(0);
    let published_text = document.createTextNode(published);
    published_cell.appendChild(published_text);

    let title_cell = newRow.insertCell(1);
    let title_text = document.createTextNode(title);
    title_cell.appendChild(title_text);

    let id_cell = newRow.insertCell(2);
    let id_text = document.createTextNode(id);
    id_cell.appendChild(id_text);
}

// Call addRow() with the table's ID
// addRow('inc_tbody');

var sidebar = L.control.sidebar('sidebar').addTo(map);
map.addControl(sidebar);

function generate_lg_html(inc_indx) {
    let inc = mapMarkers[inc_indx];
    console.log('generating html for sidebar incident list. inc index=' + inc_indx);

    let heading = inc.title;
    let cent = inc.id;
    let sml = inc.lat + ', ' + inc.lon;
    let corn = inc.published_ts;

    return '<a class="list-group-item list-group-item-action flex-column align-items-start"\n' +
        'href="#" onclick="click_inc_in_list(' + inc_indx + ')" >\n' +
        '<div class="d-flex w-100 justify-content-between">\n' +
        '<h5 class="mb-1">' + heading + '</h5>\n' +
        '<small>' + corn + '</small>\n' + '</div>\n' +
        '<p class="mb-1">' + cent + '</p>\n' +
        '<small>' + sml + '</small>\n' + '</a>';
}

function click_inc_in_list(index) {
    open_inc_popup(index);
    zoom_to_inc(index);
}

function open_inc_popup(index) {
    let inc = mapMarkers[index];
    inc.marker.openPopup();
}

function zoom_to_inc(index) {
    // TODO: Track whether sidebar is open or not, then adjust view accordingly
    let inc = mapMarkers[index];
    let inc_lat_lng = inc.marker.getLatLng();
    let zm_lvl = 13;

    console.log('zooming to inc, inc_lat_lng=');
    console.log(inc_lat_lng);

    map.setView(inc_lat_lng, zm_lvl);
}

var inc_lg_counter = 0;

function add_incident_to_sidebar_list(inc_indx) {
    console.log('adding incident to sidebar list with index = ' + inc_indx)
    let target_el_query = "incident_list_content";
    document.getElementById(target_el_query).innerHTML = generate_lg_html(inc_indx) + document.getElementById(target_el_query).innerHTML;
}

start_ms = Date.now();

function add_test_inc() {
    delta_ms = Date.now() - start_ms;
    console.log('delta_ms=');
    console.log(delta_ms);

    delta_s = delta_ms / 1000;
    modulo_ms = delta_ms % 1000;
    console.log('modulo_ms=');
    console.log(modulo_ms);

    test_id = 'TEST' + String(modulo_ms);
    test_status = 'NOSTATUS';
    test_id_status = test_id + '_' + test_status;

    test_lat = '43.1' + String(modulo_ms);
    test_lon = '-77.6' + String(modulo_ms);

    test_json_data = [
        delta_s,
        "2022-02-26 05:16:27",
        "TEST CATEGORY at TEST ADDRESS, Rochester",
        "2022-02-26 05:12:00",
        test_id_status,
        test_id,
        test_status,
        test_lat,
        test_lon
    ];

    console.log('creating test incident:');
    console.log(test_json_data);

    update_markers(test_json_data);
}

// const sound_on_toast = bootstrap.Toast.getInstance(document.getElementById('sound_on_toast'));
// const sound_off_toast = bootstrap.Toast.getInstance(document.getElementById('sound_off_toast'));
let muted = 1;

function toggle_mute() {
    if (muted < 1) {
        console.log('muted');
        muted = 1;
        document.getElementById("sound_toggle").className = "fa-solid fa-volume-xmark";
        // sound_off_toast.show()
    } else {
        console.log('unmuted');
        muted = 0;
        document.getElementById("sound_toggle").className = "fa-solid fa-volume-high unmuted";
        // sound_on_toast.show()
    }
}

function play_alert() {
    if (muted < 1) {
        const audio = new Audio(
            'https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play();
    } else {
        console.log('volume muted - not playing alert');
    }
}

