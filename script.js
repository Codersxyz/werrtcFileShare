let peerConnection = new RTCPeerConnection();
let datachannel = null;
let buffer = [];
let fileName;

let onOpen  = e => console.log("Data Channel Opened");
let packetCount = 0; // Counter for received packets
const packetsToReceive = 1000; // Number of packets to wait for before sending ACK

let onMessage = e => {
    if (typeof e.data === "string" && e.data.startsWith("FILE_NAME:")) {
        fileName = e.data.split("FILE_NAME:")[1];
        console.log(`Receiving file: ${fileName}`);
        // Initialize buffer or any other necessary setup for receiving the file
    } else if (typeof e.data === "string" && e.data === "Done") {
        console.log("Done");

        const file = new Blob(buffer);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // Set the file name
        a.click();

        URL.revokeObjectURL(url);

        buffer = [];
        packetCount = 0; // Reset packet count for next transfer
    } else {
        console.log("received");
        buffer.push(e.data);
        packetCount++;

        // Send ACK after receiving the specified number of packets
        if (packetCount >= packetsToReceive) {
            datachannel.send("ACK");
            packetCount = 0; // Reset packet count after sending ACK
        }
    }
};



peerConnection.ondatachannel = (e) => {
    datachannel = e.channel;
    datachannel.onopen = onOpen;
    datachannel.onmessage = onMessage;
}



let createOffer = async () => {

    datachannel = peerConnection.createDataChannel("fileTransfer");

    datachannel.onopen = onOpen
    datachannel.onmessage = onMessage


    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            document.getElementById('offerText').value = JSON.stringify(peerConnection.localDescription)
        }
    };

    await peerConnection.createOffer().then(offer => peerConnection.setLocalDescription(offer));
}


let createAnswer = async () => {

    let offer = JSON.parse(document.getElementById('offerText').value)

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            // console.log('Adding answer candidate...:', event.candidate)
            document.getElementById('answerText').value = JSON.stringify(peerConnection.localDescription)
        }
    };

    await peerConnection.setRemoteDescription(offer);

    await peerConnection.createAnswer().then(e =>peerConnection.setLocalDescription(e)); 
}

let addAnswer = async () => {
    let answer = JSON.parse(document.getElementById('answerText').value)

    await peerConnection.setRemoteDescription(answer);
    console.log("connection made");
}

let handleChange = () => {
    if (!fileinput.files[0]) {
        console.log("No file choosen");
        sendButton.disabled = true;
    }
    else {
        sendButton.disabled = false;
        console.log("Send button enabled");
    }
}



let sendFile = async () => {
    const file = fileinput.files[0];

    if (!file) {
        console.log("No file selected");
        return;
    }

    const buffer = await file.arrayBuffer();
    const chunkSize = 16 * 1024; // Adjust as needed
    let offset = 0;
    const packetsToSend = 1000; // Number of packets to send before waiting for ACK
    let packetCount = 0; // Counter for sent packets

    // Send the file name first
    const fileNameMessage = `FILE_NAME:${file.name}`;
    datachannel.send(fileNameMessage);

    // Store the original onMessage handler
    const originalOnMessage = datachannel.onmessage;

    const sendChunks = () => {
        while (packetCount < packetsToSend && offset < buffer.byteLength) {
            const chunk = buffer.slice(offset, offset + chunkSize);
            datachannel.send(chunk);
            offset += chunkSize;
            packetCount++;
        }

        // Check if all chunks have been sent
        if (offset >= buffer.byteLength) {
            datachannel.send("Done");
            console.log('All chunks have been sent!');
            datachannel.onmessage = originalOnMessage; // Reset the onmessage handler
        } else {
            // Wait for ACK for the sent packets
            console.log(`Waiting for ACK...`);
            datachannel.onmessage = waitForAck;
        }
    };

    const waitForAck = (e) => {
        if (e.data === 'ACK') {
            packetCount = 0; // Reset packet count for the next batch
            sendChunks(); // Send the next batch of chunks
        } else if (e.data === 'Error') {
            console.error('Error during chunk transfer');
            datachannel.onmessage = originalOnMessage; // Reset handler on error
        }
    };

    // Start sending chunks
    sendChunks();
};
