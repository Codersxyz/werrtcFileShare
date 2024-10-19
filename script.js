let peerConnection = new RTCPeerConnection();
let datachannel = null;
let buffer = [];
let fileName;

let onOpen  = e => console.log("Data Channel Opened");
let onMessage = e => {
    if (typeof e.data === "string" && e.data.startsWith("FILE_NAME:")) {
        fileName = e.data.split("FILE_NAME:")[1];
        console.log(`Receiving file: ${fileName}`);
        // Initialize buffer or any other necessary setup for receiving the file
    }
    else if (typeof e.data === "string" && e.data === "Done") {
        console.log("Done");

        const file = new Blob(buffer);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // Set the file name
        a.click();

        URL.revokeObjectURL(url);

        buffer = [];

    } 
    else {
        console.log("received");
        buffer.push(e.data);
        datachannel.send("ACK");
    }
}


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


// let sendFile = async () => {
//     const file = fileinput.files[0];

//     if (!file) {
//         console.log("No file selected");
//         return;
//     }

//     const buffer = await file.arrayBuffer();
//     const chunkSize = 16 * 1024; // Adjust as needed
//     let offset = 0;

//     // Set a low threshold for buffered amount
//     datachannel.bufferedAmountLowThreshold = 1024 * 1024; // Example: 1MB threshold

//     const sendChunk = () => {
//         // Check if we have more data to send
//         if (offset < buffer.byteLength) {
//             const chunk = buffer.slice(offset, offset + chunkSize);
//             datachannel.send(chunk);
//             offset += chunkSize;
//         } else {
//             // Send "Done" message to signal that all chunks have been sent
//             datachannel.send("Done");
//         }
//     };

//     // Listen for the 'bufferedamountlow' event
//     datachannel.onbufferedamountlow = () => {
//         sendChunk(); // Send the next chunk when the buffer is low
//     };

//     // Start sending the first chunk
//     sendChunk();
// };



let sendFile = async () => {
    const file = fileinput.files[0];

    if (!file) {
        console.log("No file selected");
        return;
    }

    const buffer = await file.arrayBuffer();
    const chunkSize = 16 * 1024; // Adjust as needed
    let offset = 0;

    // Send the file name first
    const fileNameMessage = `FILE_NAME:${file.name}`;
    datachannel.send(fileNameMessage);

    // Function to send chunks
    let promise = new Promise((resolve, reject) => {
        const sendChunk = () => {
            // Check if we have more data to send
            if (offset < buffer.byteLength) {
                const chunk = buffer.slice(offset, offset + chunkSize);
                datachannel.send(chunk);
                offset += chunkSize;
            } else {
                // Send "Done" message to signal that all chunks have been sent
                datachannel.send("Done");
                console.log('All chunks have been sent!');
                resolve(); // Resolve the promise when all chunks are sent
            }
        };

        const waitForAck = () => {
            datachannel.onmessage = e => {
                if (e.data === 'ACK') {
                    sendChunk();
                } else if (e.data === 'Error') {
                    reject(new Error('Error during chunk transfer'));
                }
            };
        };

        // Start sending the first chunk
        sendChunk(); // Send the first chunk immediately
        waitForAck();
    });

    promise.then(e => {
        datachannel.onmessage = onMessage;
        console.log("File Sent");
    })
};

