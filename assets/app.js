function formatDate(date) {
  const yyyy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDay().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const MM = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  const datestring = `${yyyy}-${mm}-${dd} ${hh}:${MM}:${ss}`;
  return datestring;
}

function App(options) {
  this.mouseAreaElement = options.mouseAreaElement;
  this.sendPingButton = options.sendPingButton;
  this.messagesContainer = options.messagesContainer;

  this.onSendPingButtonClick = function (event) {
    this.sendPayload({
      payload: {
        id: this.getTimestamp(),
        type: "kdeconnect.ping",
        body: {},
      }
    });
  };
  this.sendPingButton.addEventListener('click', this.onSendPingButtonClick.bind(this));

  this.devices = [];
  this.socket = null;

  this.blockSendingMouseMove = false;
  this.mouseMoveDelta = null;
  this.dragHandlerId = null;

  this.connect = function () {
    this.socket = new WebSocket("ws://localhost:8000/ws");

    this.socket.addEventListener("error", (event) => {
      console.error("WebSocket error:", event);
    });
  };

  this.addDevice = function (device) {
    this.devices.push({
      device_name: device.device_name,
      device_id: device.device_id,
    });

    const selectbox = document.querySelector('#deviceSelectbox');
    selectbox.options.add(new Option(device.device_name, device.device_id));
  };

  this.receivedPing = function (data) {
    const dateString = formatDate(new Date());;
    const message = document.createElement('p');
    message.classList.add('message');
    message.innerText = `[${dateString}]: Ping received from ${data.device_name}.`;
    const messageDots = document.createElement('span');
    messageDots.innerText = "..........";
    message.appendChild(messageDots);
    this.messagesContainer.prepend(message);
    const removeDot = () => {
      messageDots.innerText = messageDots.innerText.slice(1);
      if (messageDots.innerText.length > 0) {
        setTimeout(removeDot, 500);
      }
    };
    removeDot();
    setTimeout(() => {
      this.messagesContainer.removeChild(message);
    }, 5000);
  };

  this.getTimestamp = function () {
    return Date.now();
  };

  this.sendPayload = function (options) {
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
  };

  this.startSingleHold = function () {
    this.sendPayload({
      payload: {
        id: this.getTimestamp(),
        type: "kdeconnect.mousepad.request",
        body: {
          singlehold: true,
        }
      }
    });

    this.blockSendingMouseMove = false;

    if (this.mouseMoveDelta !== null) {
      this.flushMouseMoveDelta();
    }
  };

  this.flushMouseMoveDelta = function () {
    this.sendPayload({
      payload: {
        id: this.getTimestamp(),
        type: "kdeconnect.mousepad.request",
        body: {
          dx: app.mouseMoveDelta.dx,
          dy: app.mouseMoveDelta.dy,
        }
      }
    });
    this.mouseMoveDelta = null;
  };
};

const app = new App({
  mouseAreaElement: document.querySelector('#mouseArea'),
  sendPingButton: document.querySelector('#sendPingButton'),
  messagesContainer: document.querySelector('#messages'),
});
app.connect();

app.mouseAreaElement.addEventListener("click", event => {
  if (document.pointerLockElement !== app.mouseAreaElement) {
    app.mouseAreaElement.focus();
    // Sometimes warns with:
    // Request for pointer lock was denied because the document is not focused.
    // Above .focus() doesn't seem to help.
    event.target.requestPointerLock();
  }
});
app.mouseAreaElement.addEventListener("mousedown", event => {
  app.blockSendingMouseMove = true;
  app.dragHandlerId = setTimeout(() => {
    app.startSingleHold();
  }, 200);
});
app.mouseAreaElement.addEventListener("mouseup", event => {
  if (app.mouseMoveDelta !== null) {
    app.flushMouseMoveDelta();
  }
  if (app.dragHandlerId !== null) {
    clearTimeout(app.dragHandlerId);
  }
  app.blockSendingMouseMove = false;

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

  app.sendPayload({
    payload: {
      id: app.getTimestamp(),
      type: "kdeconnect.mousepad.request",
      body: body
    }
  });
});

// See https://github.com/KDE/kdeconnect-android/blob/master/src/org/kde/kdeconnect/Plugins/MousePadPlugin/KeyListenerView.java.

app.specialKeysMap = {
  8: 1, // DEL
  9: 2, // TAB
  13: 12, // ENTER
  37: 4, // DPAD_LEFT
  38: 5, // DPAD_UP
  39: 6, // DPAD_RIGHT
  40: 7, // DPAD_DOWN
  33: 8, // PAGE_UP
  34: 9, // PAGE_DOWN
  36: 10, // MOVE_HOME
  35: 11, // MOVE_END
  'KEYCODE_NUMPAD_ENTER': 12, // NUMPAD_ENTER
  46: 13, // FORWARD_DEL
  27: 14, // ESCAPE
  'KEYCODE_SYSRQ': 15, // SYSRQ
  'KEYCODE_SCROLL_LOCK': 16, // SCROLL_LOCK
  112: 21, // F1
  113: 22, // F2
  114: 23, // F3
  115: 24, // F4
  116: 25, // F5
  117: 26, // F6
  118: 27, // F7
  119: 28, // F8
  120: 29, // F9
  121: 30, // F10
  122: 31, // F11
  123: 32, // F12 source from kdeconnect-android says 21 in comment?
};

app.mouseAreaElement.addEventListener("keydown", event => {
  if (document.pointerLockElement !== app.mouseAreaElement) {
    return;
  }

  const body = {};
  if (app.specialKeysMap[ event.keyCode ]) {
    body.specialKey = app.specialKeysMap[ event.keyCode ];
  } else {
    switch (event.keyCode) {
      // NOT DO THIS BY DEFAULT. Check for a-z A-Z and only allow what we know, essentially whitelisting this bs.
      default:
        body.key = event.key;
    }
  }

  console.log(event);
  console.log(body);

  app.sendPayload({
    payload: {
      id: app.getTimestamp(),
      type: "kdeconnect.mousepad.request",
      body: body,
    }
  });
});

app.mouseAreaElement.addEventListener("mousemove", event => {
  if (document.pointerLockElement !== app.mouseAreaElement) {
    return;
  }

  if (app.blockSendingMouseMove) {
    if (app.mouseMoveDelta === null) {
      app.mouseMoveDelta = {
        dx: event.movementX,
        dy: event.movementY,
      };
    } else {
      app.mouseMoveDelta.dx += event.movementX;
      app.mouseMoveDelta.dy += event.movementY;
    }
    if (app.mouseMoveDelta.dx > 10 || app.mouseMoveDelta.dy > 10) {
      clearTimeout(app.dragHandlerId);
      app.startSingleHold();
    }
  } else {
    app.sendPayload({
      payload: {
        id: app.getTimestamp(),
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
app.socket.addEventListener("open", (event) => {
  const websocketStatus = document.querySelector('#websocketStatus');
  websocketStatus.innerHTML = 'Open';
});
app.socket.addEventListener("close", (event) => {
  const websocketStatus = document.querySelector('#websocketStatus');
  websocketStatus.innerHTML = 'Closed';
});

// Listen for messages
app.socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "device_connected":
      app.addDevice(data.data);
      break;
    case "received_ping":
      app.receivedPing(data.data);
      break;
    default:
      console.log("Message with unknown type from server: ", data);
      break;
  }
});
