import asyncio
import json
import os
import sys
import textwrap

from asyncio import CancelledError
from multiprocessing import Pipe
from multiprocessing import Queue
from pathlib import Path
from sanic import Request, Websocket, Sanic, html, redirect
from time import sleep
from queue import Empty

from pykdeconnect.client import KdeConnectClient
from pykdeconnect.const import KdeConnectDeviceType
from pykdeconnect.devices import KdeConnectDevice
from pykdeconnect.helpers import get_timestamp, keyboard_interrupt
from pykdeconnect.payloads import Payload
from pykdeconnect.plugin import Plugin
from pykdeconnect.plugin_registry import PluginRegistry
from pykdeconnect.plugins.ping import PingReceiverPlugin
from pykdeconnect.storage import FileStorage

from functools import partial
from sanic import Request, Sanic
from sanic.worker.loader import AppLoader

class MousepadPlugin(Plugin):
    @classmethod
    def create_instance(cls, device: KdeConnectDevice):
        return cls(device)

    @classmethod
    def get_incoming_payload_types(cls) -> set[str]:
        return set()

    @classmethod
    def get_outgoing_payload_types(cls) -> set[str]:
        return {"kdeconnect.mousepad.request"}

    async def handle_payload(self, payload: Payload) -> None:
        assert False

def kdeconnect_client_process(queue_to, queue_from):
    async def kdeconnect_client_process_async():
        plugin_registry = PluginRegistry()
        plugin_registry.register_plugin(MousepadPlugin)
        client = KdeConnectClient(
            'Web',
            KdeConnectDeviceType('unknown'),
            FileStorage(Path.home() / ".config" / "pykdeconnect"),
            plugin_registry
        )

        def on_ping_received_callback(device):
            async def on_ping_received_callback_imp():
                queue_from.put(f'{{"type":"received_ping","data":{{"device_id":"{device.device_id}","device_name":"{device.device_name}"}}}}')
            return on_ping_received_callback_imp

        # TODO: Ask (web)client.
        async def on_pairing_request(_: KdeConnectDevice) -> bool:
            will_pair = False
            print(f'on_pairing_request called. Returning {False}')
            return will_pair

        async def on_register_device_connected(device: KdeConnectDevice) -> bool:
            ping_receiver_plugin = plugin_registry.get_plugin(device, PingReceiverPlugin)
            ping_receiver_plugin.register_ping_callback(on_ping_received_callback(device))

            # Needs to go to ws.
            queue_from.put(f'{{"type":"device_connected","data":{{"device_id":"{device.device_id}","device_name":"{device.device_name}"}}}}')

        client.set_pairing_callback(on_pairing_request)
        client._device_manager.register_device_connected_callback(on_register_device_connected)

        await client.start()


        # # queue?
        try:
            while True:
                try:
                    msg_dict = queue_to.get(block=False)

                    device = client._device_manager.get_device(msg_dict['device_id'])

                    if device is None:
                        print(f'Trying to send payload to device with id {msg_dict["device_id"]}, but was not found.')
                    else:
                        device.send_payload(msg_dict['payload'])
                except Empty:
                    pass
                await asyncio.sleep(0)

        except (KeyboardInterrupt, CancelledError):
            pass

        await client.stop()

    try:
        asyncio.run(kdeconnect_client_process_async())
    except KeyboardInterrupt:
        pass


def create_app() -> Sanic:
    current_directory = os.path.dirname(os.path.realpath(__file__))
    assets_directory = os.path.join(current_directory, 'assets')

    app = Sanic('app')
    app.config.USE_UVLOOP = False

    app.static("/index.html", os.path.join(assets_directory, 'index.html'), name="static_index")
    app.static("/app.js", os.path.join(assets_directory, 'app.js'), name='static_app.js')

    @app.get('/')
    async def index(request: Request):
        return redirect(
            '/index.html',
            headers=None,
            status=302,
            content_type="text/html; charset=utf-8"
        )

    @app.websocket("/ws")
    async def ws(request: Request, ws: Websocket):
        # SESSION STARTS
        queue_to = request.app.shared_ctx.kdeconnect_client_queue_to
        queue_from = request.app.shared_ctx.kdeconnect_client_queue_from

        # msg = queue_from.get()
        # print(msg)
        # await ws.send(msg)

        try:

            while True:
                try:
                    msg_dict = queue_from.get(block=False)
                    await ws.send(msg_dict)
                except Empty:
                    pass

                msg = await ws.recv(timeout=1)

                if msg is not None:
                    msg_dict = json.loads(msg)

                    if msg_dict['type'] == 'payload':
                        queue_to.put({
                            'device_id': msg_dict['device_id'],
                            'payload': msg_dict['payload'],
                        })

                await asyncio.sleep(0)
        except asyncio.CancelledError as e:
            pass

    @app.main_process_start
    async def main_process_start(app):
        app.shared_ctx.kdeconnect_client_queue_to = Queue(maxsize=20)
        app.shared_ctx.kdeconnect_client_queue_from = Queue(maxsize=20)

    @app.main_process_ready
    async def main_process_ready(app: Sanic, _):
        # app.manager.manage(<name>, <callable>, <kwargs>)
        app.manager.manage("KDEConnectClient", kdeconnect_client_process, {
            "queue_to": app.shared_ctx.kdeconnect_client_queue_to,
            "queue_from":  app.shared_ctx.kdeconnect_client_queue_from
        })
    return app

app = create_app()

if __name__ == "__main__":
    # loader = AppLoader(factory=partial(create_app))
    # app = loader.load()
    # app.prepare(port=9999, dev=True)
    # Sanic.serve(primary=app, app_loader=loader)

    # app.run(single_process=True, debug=True)
    # app.run(single_process=False, debug=True)
    # app.run(single_process=False, dev=True, motd=False)
    app.run(single_process=False, dev=False, motd=False)
