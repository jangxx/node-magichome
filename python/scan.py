import socket
import time
import json

DISCOVERY_PORT = 48899

sock = socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
sock.bind(('', DISCOVERY_PORT))
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

msg = "HF-A11ASSISTHREAD".encode('ascii')

timeout = 5
# set the time at which we will quit the search
quit_time = time.time() + timeout

response_list = []
# outer loop for query send
while True:
    if time.time() > quit_time:
        break
    # send out a broadcast query
    sock.sendto(msg, ('<broadcast>', DISCOVERY_PORT))

    # inner loop waiting for responses
    while True:

        sock.settimeout(1)
        try:
            data, addr = sock.recvfrom(64)
        except socket.timeout:
            data = None
            if time.time() > quit_time:
                break

        if data is None:
            continue
        if  data == msg:
            continue

        data = data.decode('ascii')
        data_split = data.split(',')
        if len(data_split) < 3:
            continue
        item = dict()
        item['ipaddr'] = data_split[0]
        item['id'] = data_split[1]
        item['model'] = data_split[2]
        print(json.dumps(item));
        # response_list.append(item)
    # print(json.dumps(response_list))