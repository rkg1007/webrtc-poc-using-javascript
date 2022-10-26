const APP_ID = "7585e3f1c7d74a31880589d035949edd";
let TOKEN = null;
let myId = String(Math.floor(Math.random() * 10000))
let peerId;
let peerConnection;
let localStream;
let signallingServer;
let signallingChannel;

const localVideoPlayer = document.getElementById("local-video");
const remoteVideoPlayer = document.getElementById("remote-video");
const cameraButton = document.getElementById("toggle-camera");
const micButton = document.getElementById("toggle-mic");
const hangButton = document.getElementById("hang");


const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


const constraints = {
    audio: true,
    video: true,
}


const makePeerVisible = async () => {
    remoteVideoPlayer.style.display = "block";
    hangButton.style.display = "block";
}


const makePeerInvisible = async () => {
    remoteVideoPlayer.style.display = "none";
    hangButton.style.display = "none";
}


const startLocalVideoPlayer = async () => {
    localStream = await getMediaDevices(constraints)
    localVideoPlayer.srcObject = localStream;
    
    cameraButton.addEventListener("click", toggleCamera);
    micButton.addEventListener("click", toggleMic);
    hangButton.addEventListener("click", hang);
}


const toggleCamera = async () => {
    const videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        cameraButton.innerText = "camera on";
    }else{
        videoTrack.enabled = true
        cameraButton.innerText = "camera off";
    }
}

const toggleMic = async () => {
    const audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        micButton.innerText = "mic on";
    }else{
        audioTrack.enabled = true
        micButton.innerText = "mic off";
    }
}

const getMediaDevices = async (constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints);
}


const sendSignal = async (signal) => {
    await signallingServer.sendMessageToPeer({ text: JSON.stringify(signal)}, peerId);
}


const createOffer = async () => {
    await createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await sendSignal({ type: "offer", data: offer});
}


const createAnswer = async (offer) => {
    await createPeerConnection();
    // makePeerVisible();
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await sendSignal({ type: "answer", data: answer});
}


const addAnswer = async (answer) => {
    await peerConnection.setRemoteDescription(answer);
}


const addCandidate = async (candidate) => {
    if (!peerConnection) return;
    await peerConnection.addIceCandidate(candidate);
}


const handleMessageFromPeer = async (message, memberId) => {
    if (!peerId) peerId = memberId;
    message = JSON.parse(message.text);
    console.log(message);
    const {type, data} = message;
    
    switch(type) {
        case "offer": 
            await createAnswer(data);
        break;
        case "answer":
            await addAnswer(data);
            break;
        case "candidate":
            await addCandidate(data);
            break;
        default:
            console.log("Unhandled Case", message);
            break;
    }
}


const handlePeerLeft = async () => {
    makePeerInvisible();
}


const handleMemberJoined = async (memberId) => {
    peerId = memberId
    await createOffer();
}


const startSignallingServer = async () => {
    signallingServer = await AgoraRTM.createInstance(APP_ID)
    await signallingServer.login({uid: myId, token: TOKEN})

    signallingChannel = signallingServer.createChannel("channel-name");
    await signallingChannel.join();

    signallingChannel.on("MemberJoined", handleMemberJoined);
    signallingChannel.on('MemberLeft', handlePeerLeft)
    signallingServer.on("MessageFromPeer", handleMessageFromPeer);
}


const createPeerConnection = async () => {
    peerConnection = new RTCPeerConnection(servers);
    
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    });
    
    peerConnection.ontrack = (event) => { 
        remoteVideoPlayer.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        sendSignal({ type: "candidate", data: event.candidate });
    }
    
    makePeerVisible();
}


const hang = async () => {
    await signallingChannel.leave()
    await signallingServer.logout()
    makePeerInvisible();
}


const init = async () => {
    await startSignallingServer();
    await startLocalVideoPlayer();
    window.addEventListener('beforeunload', hang)
}


init();
