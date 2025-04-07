document.addEventListener('DOMContentLoaded', () => {
  updateCurrentMonth();
  fetchSchedule()
    .then(() => {
      console.log('Horario cargado correctamente, ahora cargando eventos especiales...');
      setupStickyColumn(); // Aplicar columna fija después de cargar la tabla
      setTimeout(() => {
        fetchSpecialEvents();
      }, 2000);
    })
    .catch(error => {
      console.error('Error en fetchSchedule:', error);
    });

  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const venuesToggle = document.querySelector('.venues-toggle');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  venuesToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const venuesItem = document.querySelector('.venues-item');
    venuesItem.classList.toggle('submenu-active');
  });

  document.addEventListener('click', (e) => {
    const venuesItem = document.querySelector('.venues-item');
    if (venuesItem && !venuesItem.contains(e.target)) {
      venuesItem.classList.remove('submenu-active');
    }
  });

  document.querySelectorAll('.nav-link:not(.venues-toggle)').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    });
  });

  document.getElementById('shareButton').addEventListener('click', async () => {
    try {
      const url = window.location.href;
      const monthText = document.getElementById('current-month').textContent;
      
      if (navigator.share) {
        await navigator.share({
          title: 'DJ Schedule',
          text: `Mira el horario de DJs para ${monthText}`,
          url: url
        });
      } else {
        navigator.clipboard.writeText(url);
        alert('¡Enlace copiado al portapapeles!');
      }
    } catch (err) {
      console.error('Error al compartir:', err);
      navigator.clipboard.writeText(window.location.href);
      alert('¡Enlace copiado al portapapeles!');
    }
  });
});

function updateCurrentMonth() {
  const months = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 
    'MAY', 'JUNE', 'JULY', 'AUGUST',
    'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const currentDate = new Date();
  const currentMonth = months[currentDate.getMonth()];
  
  const monthElement = document.getElementById('current-month');
  if (monthElement) {
    monthElement.textContent = currentMonth;
  }
}

async function fetchSchedule() {
  try {
    updateCurrentMonth();
    
    const SHEET_ID = '1gr_yWuMPAHMUOFo4A3mTin6vqKrlK3CiCsNL98WnMF0';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    const jsonText = text.substring(47).slice(0, -2);
    const data = JSON.parse(jsonText);
    
    const values = data.table.rows.map(row => 
      row.c.map(cell => (cell ? cell.v : ''))
    );
    
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '';

    if (!values || values.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9">No schedule data available.</td></tr>';
      return;
    }

    const dataRows = values.slice(1);

    dataRows.forEach((row, rowIndex) => {
      if (!row.some(col => String(col).trim() !== '')) return;
      const tr = document.createElement('tr');
      for (let i = 0; i < 9; i++) {
        const td = document.createElement('td');
        const cellValue = row[i] ? row[i] : '—';
        
        if (i === 0) {
          if (cellValue !== '—') {
            const nameContainer = document.createElement('div');
            nameContainer.style.display = 'flex';
            nameContainer.style.alignItems = 'center';
            nameContainer.style.gap = '8px';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = cellValue;
            
            const calendarBtn = document.createElement('button');
            calendarBtn.className = 'calendar-btn';
            calendarBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>';
            calendarBtn.title = 'Add to Calendar';
            calendarBtn.onclick = () => createCalendarEvents(row, cellValue);
            
            nameContainer.appendChild(nameSpan);
            nameContainer.appendChild(calendarBtn);
            td.appendChild(nameContainer);
          } else {
            const prevRowIndex = rowIndex - 1;
            if (prevRowIndex >= 0 && dataRows[prevRowIndex][0] !== '—') {
              const prevDjName = dataRows[prevRowIndex][0];
              
              const nameContainer = document.createElement('div');
              nameContainer.style.display = 'flex';
              nameContainer.style.alignItems = 'center';
              nameContainer.style.gap = '8px';
              
              const nameSpan = document.createElement('span');
              nameSpan.textContent = prevDjName + ' (2)';
              
              nameContainer.appendChild(nameSpan);
              td.appendChild(nameContainer);
            } else {
              td.textContent = '—';
            }
          }
        } else {
          td.textContent = cellValue;
        }
        
        if (i >= 1 && i <= 7 && cellValue !== '—') {
          const timeMatch = cellValue.match(
            /(\d+)(?::(\d+))?\s*-\s*(\d+)(?::(\d+))?/i
          );
          
          if (timeMatch) {
            let [ , startH, startM, endH, endM ] = timeMatch;
            startH = parseInt(startH, 10);
            endH = parseInt(endH, 10);
            startM = parseInt(startM || '0', 10);
            endM = parseInt(endM || '0', 10);
            
            if (startH < 12) startH += 12;
            if (endH < 12) endH += 12;
            
            const scheduleStart = startH * 60 + startM;
            const scheduleEnd = endH * 60 + endM;
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const currentDay = now.getDay();
            const dayIndex = (currentDay === 0) ? 7 : currentDay;
            
            if (i === dayIndex && currentTime >= scheduleStart && currentTime < scheduleEnd) {
              td.classList.add('current-shift');
            }
          }
          
          if (cellValue.includes('DRIFT') || cellValue.includes('AZURE') || 
              cellValue.includes('AURA') || cellValue.includes('AMMOS') || 
              cellValue.includes('BAOLI')) {
            td.setAttribute('data-venue', cellValue.split(' ')[0]);
          }
        }
        
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    });
  } catch (error) {
    document.querySelector('#schedule-table tbody').innerHTML =
      '<tr><td colspan="9">Failed to load schedule. Please try again later.</td></tr>';
  }
}

async function fetchSpecialEvents() {
  try {
    const SHEET_ID = '1gr_yWuMPAHMUOFo4A3mTin6vqKrlK3CiCsNL98WnMF0';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=Eventos&tqx=out:json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    const jsonText = text.substring(47).slice(0, -2);
    const data = JSON.parse(jsonText);
    
    const values = data.table.rows.map(row => {
      return row.c.map((cell, index) => {
        if (!cell) return '';
        
        if (index === 0 && cell.f) {
          return cell.f;
        }
        
        return cell.v || '';
      });
    });
    
    processSpecialEvents(values);
  } catch (error) {
    const testEvents = [
      ['22/03/2025', 'DRIFT', '', 'Todo el día', 'Private Event']
    ];
    processSpecialEvents(testEvents);
  }
}

function processSpecialEvents(events) {
  if (!events || events.length === 0) {
    return;
  }
  
  let legendContainer = document.getElementById('events-legend');
  if (!legendContainer) {
    legendContainer = document.createElement('div');
    legendContainer.id = 'events-legend';
    legendContainer.className = 'events-legend';
    document.querySelector('.container').appendChild(legendContainer);
  } else {
    legendContainer.innerHTML = '';
  }
  
  const legendTitle = document.createElement('h3');
  legendTitle.textContent = 'Special Events';
  legendContainer.appendChild(legendTitle);
  
  const today = new Date();
  const currentDay = today.getDay();
  
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const currentWeekMonday = new Date(today);
  currentWeekMonday.setDate(today.getDate() + mondayOffset);
  currentWeekMonday.setHours(0, 0, 0, 0);
  
  const currentWeekSunday = new Date(currentWeekMonday);
  currentWeekSunday.setDate(currentWeekMonday.getDate() + 6);
  currentWeekSunday.setHours(23, 59, 59, 999);
  
  events.forEach(event => {
    if (!event[0] || !event[1]) return;
    
    const [dateStr, venue, dj, djRequired, time, description] = event;
    
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      return;
    }
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    
    const eventDate = new Date(year, month, day);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate < currentWeekMonday || eventDate > currentWeekSunday) {
      return;
    }
    
    const eventDayOfWeek = eventDate.getDay();
    
    let tableColumnIndex;
    if (eventDayOfWeek === 0) {
      tableColumnIndex = 7;
    } else {
      tableColumnIndex = eventDayOfWeek;
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const eventElement = document.createElement('div');
    eventElement.className = 'special-event';
    eventElement.innerHTML = `
      <div class="event-date">
        <span class="event-indicator ${djRequired === 'Yes' ? 'event-with-dj' : 'event-no-dj'}"></span>
        ${dateStr} (${dayNames[eventDayOfWeek]})
      </div>
      <div class="event-details">
        <strong>${venue}</strong>
        <p class="event-info">
          ${time ? `<span class="event-time">🕒 ${time}</span>` : ''}
          ${description ? `<span class="event-description">📝 ${description}</span>` : ''}
          <span class="dj-status">👤 ${djRequired === 'Yes' ? 
            `DJ must attend (${dj})` : 
            dj ? `DJ not required (${dj})` : 
            'No DJ assigned'}</span>
        </p>
      </div>
    `;
    legendContainer.appendChild(eventElement);
    
    // Pasar el valor djRequired a la función markSpecialEventInTable
    markSpecialEventInTable(tableColumnIndex, venue, dj, time, djRequired === 'Yes');
  });
  
  if (legendContainer.querySelectorAll('.special-event').length === 0) {
    legendContainer.style.display = 'none';
  } else {
    legendContainer.style.display = 'block';
  }
}

function markSpecialEventInTable(dayOfWeek, venue, dj, time, djRequired) {
  const table = document.getElementById('schedule-table');
  if (!table) {
    return;
  }
  
  const rows = table.querySelectorAll('tbody tr');
  let marked = false;
  
  const eventTime = time || '';
  const eventTimeMatch = eventTime.match(/(\d+)(?::(\d+))?\s*-\s*(\d+)(?::(\d+))?/);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) continue;
    
    const dayCell = cells[dayOfWeek];
    if (!dayCell) continue;
    
    const cellText = dayCell.textContent || '';
    
    if (dj && dj.trim() !== '') {
      const djCell = cells[0];
      const rowDjName = djCell ? djCell.textContent.replace(' (2)', '').trim() : '';
      
      if (rowDjName.toLowerCase() === dj.toLowerCase() && eventTimeMatch) {
        const cellTimeMatch = cellText.match(/(\d+)(?::(\d+))?\s*-\s*(\d+)(?::(\d+))?/);
        if (cellTimeMatch && cellTimeMatch[0] === eventTimeMatch[0]) {
          dayCell.classList.remove('current-shift', 'potential-current-shift');
          dayCell.classList.add('special-event-cell');
          
          // Añadir clase dj-required solo si djRequired es true
          if (djRequired) {
            dayCell.classList.add('dj-required');
          }
          
          dayCell.setAttribute('title', djRequired ? 'EVENT - DJ Required' : 'EVENT/No DJ needed');
          dayCell.innerHTML = `${venue} - EVENT <span class="event-cell-indicator"></span>`;
          marked = true;
        }
      }
    } else {
      if (cellText.toUpperCase().includes(venue.toUpperCase())) {
        dayCell.classList.remove('current-shift', 'potential-current-shift');
        dayCell.classList.add('special-event-cell');
        dayCell.setAttribute('title', 'EVENT/No DJ needed');
        dayCell.innerHTML = `${venue} - EVENT <span class="event-cell-indicator"></span>`;
        marked = true;
      }
    }
  }
}

function createCalendarEvents(row, djName) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 
    'MAY', 'JUNE', 'JULY', 'AUGUST',
    'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const monthName = monthNames[currentMonth];
  
  const events = [];
  
  processRowForCalendar(row, djName, currentMonth, currentYear, currentDay, monthName, events);
  
  const tableBody = document.querySelector('#schedule-table tbody');
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  
  const currentRowIndex = rows.findIndex(r => {
    const firstCell = r.querySelector('td:first-child');
    return firstCell && firstCell.textContent.includes(djName);
  });
  
  if (currentRowIndex !== -1 && currentRowIndex + 1 < rows.length) {
    const nextRow = rows[currentRowIndex + 1];
    const firstCell = nextRow.querySelector('td:first-child');
    if (firstCell && firstCell.textContent.includes('(2)')) {
      processRowForCalendar(
        Array.from(nextRow.querySelectorAll('td')).map(td => td.textContent),
        djName,
        currentMonth,
        currentYear,
        currentDay,
        monthName,
        events
      );
    }
  }
  
  if (events.length > 0) {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SunsetDJs//Schedule//EN',
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR'
    ].join('\n');

    // Detectar si es iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    try {
      if (isIOS) {
        // Crear un data URI para iOS
        const base64Content = btoa(unescape(encodeURIComponent(icsContent)));
        const dataURI = `data:text/calendar;charset=utf-8;base64,${base64Content}`;
        window.location.href = dataURI;
      } else {
        // Mantener la descarga normal para otros dispositivos
        const calendarFile = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(calendarFile);
        link.download = `${djName}_${monthName}_Schedule.ics`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(link.href);
        }, 100);
      }
    } catch (error) {
      console.error('Error creating calendar file:', error);
      alert('There was an error creating the calendar file. Please try again.');
    }
  }
}

function processRowForCalendar(row, djName, currentMonth, currentYear, currentDay, monthName, events) {
  for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
    const shift = row[dayIndex];
    if (shift && shift !== '—') {
      const timeMatch = shift.match(/(\d+)(?::(\d+))?\s*-\s*(\d+)(?::(\d+))?/);
      if (timeMatch) {
        let [, startH, startM, endH, endM] = timeMatch;
        startH = parseInt(startH, 10);
        endH = parseInt(endH, 10);
        startM = parseInt(startM || '0', 10);
        endM = parseInt(endM || '0', 10);
        
        if (startH < 12) startH += 12;
        if (endH < 12) endH += 12;
        
        const venue = shift.split(' ')[0];
        
        // Calcular todas las fechas del mes para este día de la semana
        const weekDay = dayIndex === 7 ? 0 : dayIndex;
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        // Encontrar el primer día del mes que coincide con este día de la semana
        let targetDay = new Date(firstDayOfMonth);
        while (targetDay.getDay() !== weekDay) {
          targetDay.setDate(targetDay.getDate() + 1);
        }
        
        // Crear eventos para todas las ocurrencias de este día en el mes
        while (targetDay <= lastDayOfMonth) {
          // Solo crear eventos para días desde hoy hasta fin de mes
          if (targetDay.getTime() >= new Date(currentYear, currentMonth, currentDay).getTime()) {
            const event = createICSEvent(
              djName,
              venue,
              new Date(targetDay),
              startH,
              startM,
              endH,
              endM
            );
            events.push(event);
          }
          
          // Avanzar 7 días para la siguiente ocurrencia
          targetDay.setDate(targetDay.getDate() + 7);
        }
      }
    }
  }
}

function createICSEvent(djName, venue, date, startH, startM, endH, endM) {
  const formatDate = (date, hours = 0, minutes = 0) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const eventDate = new Date(date);
  const startDate = new Date(eventDate.setHours(startH, startM, 0));
  const endDate = new Date(eventDate.setHours(endH, endM, 0));
  
  return [
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${djName} @ ${venue}`,
    `LOCATION:${venue}`,
    'DESCRIPTION:DJ Schedule for ' + djName,
    `UID:${Date.now()}-${Math.random().toString(36).substring(2)}@sunsetdjs`,
    'END:VEVENT'
  ].join('\n');
}

// Añadir esta función al principio del archivo script.js
function setupStickyColumn() {
  if (window.innerWidth <= 768) {
    console.log("Aplicando columna fija en móvil");
    
    // Forzar estilos directamente en el DOM
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @media (max-width: 768px) {
        #schedule-container {
          position: relative !important;
          overflow: hidden !important;
          max-width: 100% !important;
        }
        
        #schedule-table {
          display: block !important;
          overflow-x: auto !important;
          white-space: nowrap !important;
        }
        
        #schedule-table th:first-child,
        #schedule-table td:first-child {
          position: sticky !important;
          left: 0 !important;
          z-index: 999 !important;
        }
        
        #schedule-table th:first-child {
          background-color: #0066cc !important;
        }
        
        #schedule-table td:first-child {
          background-color: white !important;
          box-shadow: 5px 0 10px -5px rgba(0,0,0,0.3) !important;
        }
        
        #schedule-table tr:nth-child(even) td:first-child {
          background-color: rgba(0, 102, 204, 0.05) !important;
        }
      }
    `;
    document.head.appendChild(styleElement);
    
    console.log("Estilos inyectados directamente en el DOM");
  }
}

// Asegurarse de que se llame después de cargar la tabla
window.addEventListener('DOMContentLoaded', () => {
  console.log("DOM cargado, esperando a cargar la tabla");
});

// También ejecutar cuando cambie el tamaño de la ventana
window.addEventListener('resize', setupStickyColumn);