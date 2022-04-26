const all_incidents_map = new Map();
const max_num_markers = 250;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const inc_str = urlParams.get('inc');
console.log('inc_str=' + inc_str);

var map = L.map('map', {
    preferCanvas: true,
    minZoom: 10,
    maxZoom: 18
});
map.setView([43.1427, -77.6161], 10);
map.zoomControl.setPosition('bottomright');

fetch('/map_token')
    .then(response => response.text())
    .then((response) => {
        console.log('map_token=');
        console.log(response);

        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            tileSize: 512,
            zoomOffset: -1,
            id: 'mapbox/dark-v10',
            accessToken: String(response) //ENTER YOUR ACCESS TOKEN HERE
        }).addTo(map);
    });

window.onload = (event) => {
    console.log('page is fully loaded');
    // fetch_last(10);
};

fetch_hours = 3;
console.log('fetching incidents from the last ' + fetch_hours + 'hours..');
fetch(`/incidents/init`)
    .then(response => response.json())
    .then(response => {
        // console.log('since response text:');
        // console.log(response);

        console.log('Loaded ' + response.length + ' incident records from the past ' + fetch_hours + ' hours');

        console.log('response stringified:' + JSON.stringify(response));

        // parsed_response = JSON.parse(response)
        // console.log('parsed_response:' + parsed_response)

        for (const message of response) {
            console.log('single message:' + message);

            let message_json_stringified = JSON.stringify(message);
            console.log('message json stringified:' + message_json_stringified);

            let json_message_data = message.data;
            console.log('message_data' + json_message_data);

            process_event_msg(json_message_data);
        }
    });


if (inc_str != null) {
    console.log('inc_str is not null.. looking up id=' + inc_str);
    fetch('/incidents/id/' + inc_str)
        .then(response => response.json())
        .then(response => {
            console.log('query id = ' + inc_str + '. response=');
            console.log(response);
            load_incident_query(inc_str, response);
        });
}

function load_incident_query(inc_str, query_response) {
    console.log('generating incident obj from query response');

    console.log('query_response=');
    console.log(query_response);

    geo = query_response.geo.split(",");  // geo is in "lon,lat" format

    const inc_obj = {
        addr: query_response.addr,
        agency: query_response.agency,
        id: inc_str,
        lat: geo[1],
        lon: geo[0],
        status: [],
        ts: query_response.ts,
        type: query_response.type,
    };

    if ('WAITING' in query_response) {
        inc_obj.status.unshift({ts: query_response.WAITING, type: 'WAITING'});
    }
    if ('DISPATCHED' in query_response) {
        inc_obj.status.unshift({ts: query_response.DISPATCHED, type: 'DISPATCHED'});
    }
    if ('ENROUTE' in query_response) {
        inc_obj.status.unshift({ts: query_response.ENROUTE, type: 'ENROUTE'});
    }
    if ('ONSCENE' in query_response) {
        inc_obj.status.unshift({ts: query_response.ONSCENE, type: 'ONSCENE'});
    }

    console.log('returning incident obj:');
    console.log(inc_obj);

    add_new_incident(inc_obj);
    click_inc_in_list(inc_str);
}

const live_source_delay_ms = 2500;
setTimeout(() => {
    // Starts the live event listener after some time has passed
    console.log('starting live events listener');
    var source_live = new EventSource('/incidents/live');
    source_live.addEventListener('message', function (e) {
        console.log('got live event message:' + e);
        console.log('live event message data:' + e.data);

        let message_json_parsed = JSON.parse(e.data);
        console.log('e.data json parsed:' + message_json_parsed);

        if ('heartbeat' in message_json_parsed) {
            console.log('got heartbeat');
        } else {
            process_event_msg(message_json_parsed);
        }
    }, false);
}, live_source_delay_ms);

function process_event_msg(json_record) {
    // Does the initial processing of an event message
    // Checks if it's in the client's event list and adds it if necessary
    // if event already exists, then the new status is added
    console.log('got event message, updating markers');
    const new_inc_obj = inc_obj_from_json(json_record);

    // check if id is in markers yet
    console.log('all_incidents_map.size=' + all_incidents_map.size);


    if (all_incidents_map.has(new_inc_obj.id)) {
        // incident ID already exists, add this updated status to it
        update_inc_status(new_inc_obj);
        return 1;
    }

    console.log('incident not found in all_incidents_map, adding now..');

    let status_obj = {
        ts: new_inc_obj.ts,
        type: new_inc_obj.status
    };
    new_inc_obj.status = [];
    new_inc_obj.status.unshift(status_obj);  // add status to incident

    add_new_incident(new_inc_obj);  // adds incident to all_incidents_map
}

function add_new_incident(new_inc) {
    // adds new incident to global all_incidents_map, attaches map marker and places on sidebar list, then plays alert
    console.log('adding new incident to client with ID=' + new_inc.id);

    // add marker, popup, etc
    new_inc = add_marker_to_incident(new_inc);
    console.log('added marker to incident. updated incident=');
    console.log(new_inc);

    // new_incident_marker.marker.openPopup();
    all_incidents_map.set(new_inc.id, new_inc);
    let num_markers = all_incidents_map.size;

    console.log('added new incident. num_markers = ' + num_markers + '. max_num_markers = ' + max_num_markers);

    if (num_markers > max_num_markers) {
        console.log('exceeded maximum number of markers (' + max_num_markers + '), removing the oldest entry.');
        const [oldest_id] = map.keys();
        console.log('oldest id=' + oldest_id); // 👉️ a
        const [oldest_inc] = map.values();
        console.log('oldest inc=' + oldest_inc); // 👉️ 1

        map.removeLayer(oldest_inc.marker);
        all_incidents_map.delete(oldest_id);
        console.log('removed oldest incident with id=' + oldest_id);
    }

    console.log('marker add complete. total markers = ' + all_incidents_map.size);

    console.log('incident added to all_incident_map=');
    console.log(all_incidents_map);

    console.log('adding incident to sidebar');
    add_incident_to_sidebar_list(new_inc.id);
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

    let popup_str = get_popup_html(inc);

    const popup_options =
        {
            'maxWidth': '250',
            'className': 'custom_popup'
        };

    console.log('adding marker with string:');
    console.log(popup_str);
    marker.bindPopup(popup_str, popup_options);

    inc.marker = marker;

    return inc;
}

function update_inc_status(inc_obj) {
    // status value is an array of status_items
    target_id = inc_obj.id;
    console.log('updating marker with id=' + target_id);

    let new_status_item = {
        ts: inc_obj.ts,
        type: inc_obj.status
    };

    // get current inc, add new status entry, re-map to updated incident
    let temp_inc = all_incidents_map.get(target_id);
    temp_inc.status.unshift(new_status_item);
    all_incidents_map.set(target_id, temp_inc);

    console.log('marker with updated status=');
    console.log(all_incidents_map.get(target_id));

    update_marker_popup(target_id);
}

function inc_obj_from_json(json_record) {
    // do all fixups here: string, capitalize, etc
    console.log('generating incident obj from json record');

    console.log('json_record:');
    console.log(json_record);

    const inc_obj = {
        addr: json_record["addr"],
        agency: json_record["agency"],
        id: json_record["id"],
        lat: json_record["lat"],
        lon: json_record["lon"],
        status: json_record["status"],
        ts: json_record["ts"],
        type: json_record["type"],
    };

    console.log('returning incident obj:');
    console.log(inc_obj);
    return inc_obj;
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


function update_marker_popup(inc_id) {
    console.log('updating marker for inc id=' + inc_id);
    let temp_inc = all_incidents_map.get(inc_id);
    let popup_str = get_popup_html(temp_inc);
    temp_inc.marker.setPopupContent(popup_str);
    all_incidents_map.set(inc_id, temp_inc);
}

function get_popup_html(inc) {
    return '<h4 style="text-align: center;"><span style="color: #000000;"><strong>' + inc.type + '</strong></span></h4>\n' +
        '<h5 style="text-align: center;"><span style="color: #323232;">' + inc.addr + '</span></h5>\n' +
        '<h5 style="text-align: center;">ID: ' + inc.id + '</h5>\n' +
        '<h6 style="text-align: center;"><span style="color: #2f1e1e;">' + convert_ts_to_est(inc.status.at(-1).ts) + '</span></h6>\n' +
        '<h5 style="text-align: center;"><a href="https://911mapr.com/?inc=' + inc.id + '">Link to this incident</a></h5>';
}

function convert_ts_to_est(ts) {
    //    example of incoming ts = "2022-04-05 04:13:00"

    // convert to ISO 8601 format
    let split_ts = ts.split(" ");
    const utc_date = split_ts[0] + 'T' + split_ts[1] + 'Z';

    let date = new Date(utc_date);
    let local_date_str = date.toLocaleString();

    local_date_str = local_date_str.replace('T', ' ');
    local_date_str = local_date_str.replace('Z', ' ');

    return local_date_str;

}

//{"ts": "2022-04-05 04:13:00", "id": "ROCE2209500025", "status": "WAITING", "type": "MVA / NO INJURIES", "addr": "W RIDGE RD/RIDGEWAY AVE ROC", "agency": "ROC", "lat": "+43.1944", "lon": "-77.6267"}

const lc = L.control.locate({
    position: 'bottomright',
    strings: {
        title: "Show me where I am, yo!"
    }
}).addTo(map);

// coordinates limiting the map
function getBounds() {
    const southWest = new L.LatLng(42.65, -78.5);
    const northEast = new L.LatLng(43.70, -76.80);
    return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(getBounds());

// var boundingBox = L.rectangle(getBounds(), {color: "#ff7800", weight: 1});
// map.addLayer(boundingBox);

// zoom the map to the bounding box
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

function get_sidebar_lg_html(id) {
    let inc = all_incidents_map.get(id);
    console.log('generating html for sidebar incident list. inc id=' + id);

    let heading = inc.type + ' at ' + inc.addr;
    let cent = inc.id;
    let sml = inc.lat + ', ' + inc.lon;
    let corn = convert_ts_to_est(inc.status.at(-1).ts);

    return '<a class="list-group-item list-group-item-action flex-column align-items-start"\n' +
        'href="#" onclick="click_inc_in_list(\'' + String(id) + '\')" >\n' +
        '<div class="d-flex w-100 justify-content-between">\n' +
        '<h5 class="mb-1">' + heading + '</h5>\n' +
        '<small>' + corn + '</small>\n' + '</div>\n' +
        '<p class="mb-1">' + cent + '</p>\n' +
        '<small>' + sml + '</small>\n' + '</a>';
}

function click_inc_in_list(id) {
    console.log('clicking on inc with ID=' + id);
    open_inc_popup(id);
    zoom_to_inc(id);
    // TODO: close incident list on mobile after selecting incident from list
}

function open_inc_popup(id) {
    console.log('opening inc popup with ID=' + id);
    let inc = all_incidents_map.get(id);
    inc.marker.openPopup();
}

function zoom_to_inc(id) {
    console.log('zooming to inc with ID=' + id);
    // TODO: Track whether sidebar is open or not, then adjust view accordingly
    let inc = all_incidents_map.get(id);
    let inc_lat_lng = inc.marker.getLatLng();
    let zm_lvl = 13;

    console.log('zooming to inc, inc_lat_lng=');
    console.log(inc_lat_lng);

    map.setView(inc_lat_lng, zm_lvl);
}

var inc_lg_counter = 0;

function add_incident_to_sidebar_list(id) {
    console.log('adding incident to sidebar list with id = ' + id);
    let target_el_query = "incident_list_content";
    document.getElementById(target_el_query).innerHTML = get_sidebar_lg_html(id) + document.getElementById(target_el_query).innerHTML;
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

    process_event_msg(test_json_data);
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
