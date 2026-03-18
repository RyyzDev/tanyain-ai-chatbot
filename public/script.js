const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const appLayout = document.getElementById('app-layout');
const interactiveSection = document.getElementById('interactive-section');
const interactiveContent = document.getElementById('interactive-content');
const closeBtn = document.getElementById('close-interactive');

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = '';

  const typingId = showTyping();

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    });

    removeTyping(typingId);

    if (response.ok) {
      let fullText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const botMsgEl = appendMessage('bot', '');
      let isJsonStarted = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        
        const trimmed = fullText.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          isJsonStarted = true;
          botMsgEl.innerHTML = "Kak AI lagi nyiapin konten interaktif buat kamu... 🎨";
        } else {
          if (!isJsonStarted) {
            // Render dengan format bold
            botMsgEl.innerHTML = formatText(fullText);
          }
        }
        scrollToBottom();
      }

      const jsonBlocks = findJsonBlocks(fullText);
      if (jsonBlocks.length > 0) {
        interactiveContent.innerHTML = '';
        appLayout.classList.add('active-interactive');
        
        jsonBlocks.forEach(jsonStr => {
          try {
            const data = JSON.parse(jsonStr);
            processAndRender(data);
          } catch (e) {
            console.error("JSON Parse Error", e);
          }
        });
        
        if (isJsonStarted) {
          botMsgEl.remove();
        }
      }
    }
  } catch (error) {
    removeTyping(typingId);
    appendMessage('bot', 'Aduh, koneksi putus!');
  }
});

// Fungsi untuk format Markdown sederhana (**bold**) dan Baris Baru (\n)
function formatText(text) {
  // 1. Escape HTML (Keamanan)
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Format Bold (**teks**)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. Format Baris Baru (\n)
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

closeBtn.onclick = () => {
  appLayout.classList.remove('active-interactive');
};

// Handle Quick Chat Buttons
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.onclick = () => {
    input.value = btn.getAttribute('data-msg');
    form.dispatchEvent(new Event('submit'));
  };
});

function findJsonBlocks(str) {
  const blocks = [];
  let braceCount = 0;
  let bracketCount = 0;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '{' || char === '[') {
      if (braceCount === 0 && bracketCount === 0) start = i;
      if (char === '{') braceCount++;
      if (char === '[') bracketCount++;
    } else if (char === '}' || char === ']') {
      if (char === '}') braceCount--;
      if (char === ']') bracketCount--;
      if (braceCount === 0 && bracketCount === 0 && start !== -1) {
        blocks.push(str.substring(start, i + 1));
        start = -1;
      }
    }
  }
  return blocks;
}

function processAndRender(data) {
  if (!data || typeof data !== 'object') return;

  // New Latihan Soal format
  if (data.questions && Array.isArray(data.questions)) {
    const title = data.title || "Latihan Soal";
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '15px';
    header.innerHTML = `<h3 style="color: var(--primary-color);">📝 ${title}</h3>`;
    interactiveContent.appendChild(header);
    data.questions.forEach(q => renderQuizCard(q));
    return;
  }

  // New Todo List format
  if (data.todo_list && Array.isArray(data.todo_list)) {
    renderPlannerCard(data);
    return;
  }

  // Legacy/Other formats
  if (data.pertanyaan || data.question || data.type === 'quiz') {
    renderQuizCard(data);
    return;
  }

  if (data.tasks || data.daftar_tugas || data.item || data.aktivitas) {
    renderPlannerCard(data);
    return;
  }

  if (Array.isArray(data)) {
    const first = data.find(i => i && typeof i === 'object');
    if (first) {
      if (first.pertanyaan || first.question) {
        data.forEach(q => renderQuizCard(q));
      } else {
        renderPlannerCard(data);
      }
    } else if (typeof data[0] === 'string') {
      renderPlannerCard(data);
    }
    return;
  }

  Object.keys(data).forEach(key => {
    const val = data[key];
    if (val && typeof val === 'object') {
       processAndRender(val);
    }
  });
}

function renderQuizCard(q) {
  const question = q.question || q.pertanyaan || q.soal || "Pertanyaan tidak ditemukan";
  const options = q.options || q.pilihan_jawaban || q.pilihan || [];
  const answer = q.answer || q.jawaban_benar || q.kunci_jawaban || "";
  const explanation = q.explanation || q.penjelasan || "Gak ada penjelasan tambahan.";

  const card = document.createElement('div');
  card.classList.add('card');
  card.innerHTML = `<div class="quiz-q">${question}</div>`;
  
  const optsDiv = document.createElement('div');
  optsDiv.classList.add('quiz-opts');
  
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.classList.add('opt-btn');
    btn.innerText = opt;
    btn.onclick = () => {
      const btns = optsDiv.querySelectorAll('.opt-btn');
      btns.forEach(b => b.disabled = true);
      
      const isCorrect = opt.toString().toLowerCase().trim() === answer.toString().toLowerCase().trim() || 
                        opt.toString().includes(answer) || answer.toString().includes(opt);

      if (isCorrect) {
        btn.classList.add('correct');
        showExp(card, "✅ Mantap! " + explanation);
      } else {
        btn.classList.add('wrong');
        showExp(card, "❌ Kurang tepat. Jawabannya: " + answer + ". " + explanation);
      }
    };
    optsDiv.appendChild(btn);
  });

  card.appendChild(optsDiv);
  interactiveContent.appendChild(card);
  interactiveContent.scrollTop = interactiveContent.scrollHeight;
}

function renderPlannerCard(data) {
  let tasks = [];
  let title = "Checklist Kamu";

  if (Array.isArray(data)) {
    tasks = data;
  } else {
    tasks = data.tasks || data.daftar_tugas || data.todo_list || data.daftar_belanja || [];
    title = data.title || data.judul || data.recipe_name || title;
  }
  
  const card = document.createElement('div');
  card.classList.add('card');
  card.innerHTML = `<div class="quiz-q">📅 ${title}</div>`;
  
  const list = document.createElement('ul');
  list.classList.add('task-list');
  
  tasks.forEach(task => {
    // Check if it has nested tasks (stage structure)
    if (typeof task === 'object' && task.tasks && Array.isArray(task.tasks)) {
      const stageHeader = document.createElement('li');
      stageHeader.innerHTML = `<strong style="color: #4f46e5; display: block; margin-top: 15px; margin-bottom: 5px; font-size: 0.95rem;">📍 ${task.stage || task.kategori || 'Tahap'}</strong>`;
      stageHeader.style.listStyle = 'none';
      list.appendChild(stageHeader);
      
      task.tasks.forEach(subTask => {
        appendTaskItem(list, subTask);
      });
    } else {
      appendTaskItem(list, task);
    }
  });
  
  card.appendChild(list);
  interactiveContent.appendChild(card);
  interactiveContent.scrollTop = interactiveContent.scrollHeight;
}

function appendTaskItem(list, task) {
    let time, activity, amount = "", note = "";
    
    if (typeof task === 'string') {
      activity = task;
    } else {
      time = task.time || task.waktu || task.jam || task.kategori || task.tahap || "";
      activity = task.activity || task.kegiatan || task.tugas || task.item || task.aktivitas || "";
      amount = task.jumlah ? ` (${task.jumlah})` : "";
      const rawNote = task.catatan || task.status || "";
      note = rawNote ? `<br><small style="color: #64748b; font-weight: 400;">💡 ${rawNote}</small>` : "";
    }

    const li = document.createElement('li');
    li.classList.add('task-item');
    li.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 8px;">
           ${time ? `<span class="task-time">${time}</span>` : ''}
           <span>${activity}${amount}</span>
        </div>
        ${note}
      </div>
    `;
    li.onclick = () => li.classList.toggle('completed');
    list.appendChild(li);
}

function showExp(parent, text) {
  const div = document.createElement('div');
  div.classList.add('explanation-box');
  div.innerText = text;
  parent.appendChild(div);
}

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  // Gunakan formatText untuk pesan awal
  msg.innerHTML = formatText(text);
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function showTyping() {
  const t = document.createElement('div');
  t.id = 'typing-' + Date.now();
  t.classList.add('message', 'bot');
  t.innerText = 'Kak AI lagi mikir...';
  chatBox.appendChild(t);
  scrollToBottom();
  return t.id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

window.onload = () => {
  appendMessage('bot', 'Halo! Kak AI di sini. Mau kuis atau curhat materi? TanyAIn aja! 🚀');
};
