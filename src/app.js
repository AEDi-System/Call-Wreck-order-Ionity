(function () {
  "use strict";

  const btn = document.getElementById("record-btn");
  const status = document.getElementById("status");
  const list = document.getElementById("recording-list");

  let mediaRecorder = null;
  let chunks = [];

  btn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toLocaleTimeString();

        const li = document.createElement("li");
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = url;
        const label = document.createElement("span");
        label.textContent = ts;
        li.appendChild(audio);
        li.appendChild(label);
        list.prepend(li);

        btn.textContent = "⏺ Record";
        btn.classList.remove("recording");
        status.textContent = "Recording saved. Press the button to record again.";
      };

      mediaRecorder.start();
      btn.textContent = "⏹ Stop";
      btn.classList.add("recording");
      status.textContent = "Recording…";
    } catch (err) {
      status.textContent = "Microphone access denied: " + err.message;
    }
  });
})();
