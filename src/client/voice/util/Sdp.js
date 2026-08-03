'use strict';

const { getPayloadType } = require('./VoiceConstants');

/**
 * Dựng mô tả SDP cho ffmpeg đọc, khi phát video qua Go Live.
 * @param {number} portUdpH264 Cổng UDP cho luồng H264
 * @param {?number} portUdpH265 Cổng UDP cho luồng H265, bỏ trống thì không khai
 * @param {number} portUdpOpus Cổng UDP cho luồng audio
 * @returns {string}
 */
function getSDPCodecName(portUdpH264, portUdpH265, portUdpOpus) {
  const payloadTypeH264 = getPayloadType('H264');
  const payloadTypeH265 = getPayloadType('H265');
  const payloadTypeOpus = getPayloadType('opus');
  let sdpData = `v=0
o=- 0 0 IN IP4 0.0.0.0
s=-
c=IN IP4 0.0.0.0
t=0 0
a=tool:libavformat 61.1.100
m=video ${portUdpH264} RTP/AVP ${payloadTypeH264}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH264} H264/90000
a=fmtp:${payloadTypeH264} profile-level-id=42e01f;sprop-parameter-sets=Z0IAH6tAoAt2AtwEBAaQeJEV,aM4JyA==;packetization-mode=1
${
  portUdpH265
    ? `m=video ${portUdpH265} RTP/AVP ${payloadTypeH265}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH265} H265/90000`
    : ''
}
m=audio ${portUdpOpus} RTP/AVP ${payloadTypeOpus}
c=IN IP4 127.0.0.1
b=AS:96
a=rtpmap:${payloadTypeOpus} opus/48000/2
a=fmtp:${payloadTypeOpus} minptime=10;useinbandfec=1
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=extmap:13 urn:3gpp:video-orientation
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
`;
  return sdpData;
}

module.exports = { getSDPCodecName };
