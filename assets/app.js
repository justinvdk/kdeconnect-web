
// app state.
const App = {
	devices: [],
	socket: null,

  connect: function() {
    console.log(this)
    this.socket = new WebSocket("ws://localhost:8000/ws");
  },

	addDevice: function (device) {
		this.devices.push({
			device_name: device.device_name,
			device_id: device.device_id,
		});

		const selectbox = document.querySelector('#deviceSelectbox');
		selectbox.options.add(new Option(device.device_name, device.device_id));
	},
	getTimestamp: function () {
		return Date.now();
	},
	sendPayload: function (deviceId, payload) {
		this.socket.send(JSON.stringify({
			type: 'payload',
			device_id: deviceId,
			payload: payload
		}));
	},
};
App.connect = App.connect.bind(App);
App.addDevice = App.addDevice.bind(App);
App.getTimestamp = App.getTimestamp.bind(App);
App.sendPayload = App.sendPayload.bind(App);
App.connect();

document.querySelector('#buttonLeftClick').addEventListener("click", event => {
	const selectbox = document.querySelector('#deviceSelectbox');
	const deviceId = selectbox.value;

	App.sendPayload(deviceId, {
		id: App.getTimestamp(),
		type: "kdeconnect.mousepad.request",
		body: {
			singleclick: true,
		}
	});
});
document.querySelector('#buttonMiddleClick').addEventListener("click", event => {
	const selectbox = document.querySelector('#deviceSelectbox');
	const deviceId = selectbox.value;

	App.sendPayload(deviceId, {
		id: App.getTimestamp(),
		type: "kdeconnect.mousepad.request",
		body: {
			middleclick: true,
		}
	});
});
document.querySelector('#buttonRightClick').addEventListener("click", event => {
	const selectbox = document.querySelector('#deviceSelectbox');
	const deviceId = selectbox.value;

	App.sendPayload(deviceId, {
		id: App.getTimestamp(),
		type: "kdeconnect.mousepad.request",
		body: {
			rightclick: true,
		}
	});
});
const mouseAreaElement = document.querySelector('#mouseArea');
mouseAreaElement.addEventListener("click", event => {
	if (document.pointerLockElement === mouseAreaElement) {
		const selectbox = document.querySelector('#deviceSelectbox');
		const deviceId = selectbox.value;

		App.sendPayload(deviceId, {
			id: App.getTimestamp(),
			type: "kdeconnect.mousepad.request",
			body: {
				singleclick: true,
			}
		});
	} else {
		event.target.requestPointerLock();
	}
});
mouseAreaElement.addEventListener("keydown", event => {
	console.log(event);

	const selectbox = document.querySelector('#deviceSelectbox');
	const deviceId = selectbox.value;

	if (document.pointerLockElement !== mouseAreaElement) {
		return;
	}

	App.sendPayload(deviceId, {
		id: App.getTimestamp(),
		type: "kdeconnect.mousepad.request",
		body: {
			key: event.key,
		}
	});
});
mouseAreaElement.addEventListener("mousemove", event => {
	const selectbox = document.querySelector('#deviceSelectbox');
	const deviceId = selectbox.value;

	if (document.pointerLockElement !== mouseAreaElement) {
		return;
	}

	App.sendPayload(deviceId, {
		id: App.getTimestamp(),
		type: "kdeconnect.mousepad.request",
		body: {
			dx: event.movementX,
			dy: event.movementY,
		}
	});
});

// Connection opened
App.socket.addEventListener("open", (event) => {
	const websocketStatus = document.querySelector('#websocketStatus');
  websocketStatus.innerHTML = 'Open';
});
App.socket.addEventListener("close", (event) => {
	const websocketStatus = document.querySelector('#websocketStatus');
  websocketStatus.innerHTML = 'Closed';
});

// Listen for messages
App.socket.addEventListener("message", (event) => {
	const data = JSON.parse(event.data);
	switch (data.type) {
		case "device_connected":
			App.addDevice(data.data);
			break;
		default:
			console.log("Message with unknown type from server: ", data);
			break;
	}
});
