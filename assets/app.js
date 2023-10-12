
// app App.
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
	sendPayload: function(options) {
		const selectbox = document.querySelector('#deviceSelectbox');
		const deviceId = selectbox.value;

		if (options.deviceId) {
			deviceId = options.deviceId;
		}

		this.socket.send(JSON.stringify({
			type: 'payload',
			device_id: deviceId,
			payload: options.payload
		}));
	},

	blockSendingMouseMove: false,
	mouseMoveDelta: null,
	dragHandlerId: null,
};
App.connect = App.connect.bind(App);
App.addDevice = App.addDevice.bind(App);
App.getTimestamp = App.getTimestamp.bind(App);
App.sendPayload = App.sendPayload.bind(App);

App.connect();

const mouseAreaElement = document.querySelector('#mouseArea');

function startSingleHold() {
	App.sendPayload({
		payload: {
			id: App.getTimestamp(),
			type: "kdeconnect.mousepad.request",
			body: {
				singlehold: true,
			}
		}
	});

	App.blockSendingMouseMove = false;

	if (App.mouseMoveDelta !== null) {
		App.sendPayload({
			payload: {
				id: App.getTimestamp(),
				type: "kdeconnect.mousepad.request",
				body: {
					dx: App.mouseMoveDelta.dx,
					dy: App.mouseMoveDelta.dy,
				}
			}
		});
		App.mouseMoveDelta = null;
	}
}

mouseAreaElement.addEventListener("mousedown", event => {
	if (document.pointerLockElement !== mouseAreaElement) {
		mouseAreaElement.focus();
		event.target.requestPointerLock();
	}

	App.blockSendingMouseMove = true;
	App.dragHandlerId = setTimeout(() => {
		startSingleHold();
	}, 200);
});
mouseAreaElement.addEventListener("mouseup", event => {
	if (App.mouseMoveDelta !== null) {
		// maybe explicitly NOT do this? Reducing cursor-stutter when quickly clicking?
		App.sendPayload({
			payload: {
				id: App.getTimestamp(),
				type: "kdeconnect.mousepad.request",
				body: {
					dx: App.mouseMoveDelta.dx,
					dy: App.mouseMoveDelta.dy,
				}
			}
		});
	}
	if (App.dragHandlerId !== null) {
		clearTimeout(App.dragHandlerId);
	}
	App.blockSendingMouseMove = false;

	const body = {};
	switch (event.button) {
		case 2:
			body.rightclick = true;
			break;
		case 0:
		default:
			body.singleclick = true;
			break;
	}

	App.sendPayload({
		payload: {
			id: App.getTimestamp(),
			type: "kdeconnect.mousepad.request",
			body: body
		}
	});
});


mouseAreaElement.addEventListener("keydown", event => {
	if (document.pointerLockElement !== mouseAreaElement) {
		return;
	}

	console.log(event);

	App.sendPayload({
		payload: {
			id: App.getTimestamp(),
			type: "kdeconnect.mousepad.request",
			body: {
				key: event.key,
			}
		}
	});
});

mouseAreaElement.addEventListener("mousemove", event => {
	if (document.pointerLockElement !== mouseAreaElement) {
		return;
	}

	if (App.blockSendingMouseMove) {
		console.log(`mousemove non blocking`);
		if (App.mouseMoveDelta === null) {
			App.mouseMoveDelta = {
				dx: event.movementX,
				dy: event.movementY,
			};
		} else {
			App.mouseMoveDelta.dx += event.movementX;
			App.mouseMoveDelta.dy += event.movementY;
		}
		if (App.mouseMoveDelta.dx > 10 || App.mouseMoveDelta.dy > 10) {
			startSingleHold();
		}
	} else {
		console.log(`mousemove blocking`);
		App.sendPayload({
			payload: {
				id: App.getTimestamp(),
				type: "kdeconnect.mousepad.request",
				body: {
					dx: event.movementX,
					dy: event.movementY,
				}
			}
		});
	}
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
