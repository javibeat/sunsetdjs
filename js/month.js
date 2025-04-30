document.addEventListener('DOMContentLoaded', () => {
    updateCurrentMonth();
    fetchWeeklySchedule()
        .then(() => {
            console.log('Horario mensual cargado, ahora eventos especiales...');
            setTimeout(() => {
                fetchSpecialEvents();
            }, 2000);
        })
        .catch(error => {
            console.error('Error cargando horario:', error);
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
    } else {
        console.error('Element with ID "current-month" not found.');
    }
}

async function fetchWeeklySchedule() {
    try {
        const SHEET_ID = '1gr_yWuMPAHMUOFo4A3mTin6vqKrlK3CiCsNL98WnMF0';
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=Month&tqx=out:json`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonText);
        
        const values = data.table.rows.map(row => 
            row.c.map(cell => (cell ? cell.v : ''))
        );
        
        // Simplemente renderizar la tabla sin verificar el mes
        renderWeeklyTables(values);
    } catch (error) {
        console.error('Error loading weekly schedule:', error);
        document.getElementById('schedule-container').innerHTML = 
            '<p>Error loading schedule. Please reload.</p>';
    }
}

function renderWeeklyTables(data) {
  window.lastScheduleData = data; // Guarda para refrescar tras eventos
  const container = document.getElementById('schedule-container');
  container.innerHTML = '';

  const headers = ["MAY", "JAVI", "REDA", "YASIN", "BATU", "ELENA", "EMRE"];
  const table = document.createElement('table');
  table.id = 'weekly-schedule-table';
  table.className = 'weekly-schedule-table';

  const now = new Date();
  const today = now.getDate();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every(cell => cell === "" || cell === null)) continue;
    const tr = document.createElement('tr');
    
    for (let j = 0; j < headers.length; j++) {
        const td = document.createElement('td');
        td.textContent = (row[j] !== undefined && row[j] !== null) ? row[j] : '';
    
        const djName = headers[j]; // Definir djName aquí
    
        // Marcar turno actual en verde
        if (
          j > 0 &&
          Number(row[0]) === today &&
          td.textContent.trim() !== ""
        ) {
          const match = td.textContent.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (match) {
            const startMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
            const endMinutes = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
            if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
              td.classList.add('dj-active');
            }
          }
        }
    
        // Marcar evento especial
        const dayNum = row[0];
        if (specialEventsByDay[dayNum] && 
            specialEventsByDay[dayNum].dj === djName) {
            const event = specialEventsByDay[dayNum];
            const eventClass = event.djRequired === 'Yes' ? 'event-with-dj' : 'event-no-dj';
            
            td.classList.add(eventClass);
            td.title = `${event.venue}\n${event.schedule}\n${event.description || ''}`;
        }
    
        tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

let specialEventsByDay = {};

async function fetchSpecialEvents() {
    try {
        const SHEET_ID = '1gr_yWuMPAHMUOFo4A3mTin6vqKrlK3CiCsNL98WnMF0';
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=Eventos&tqx=out:json`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonText);

        // Obtener el mes actual de la hoja Month (asegúrate que window.lastScheduleData existe)
        const sheetMonth = window.lastScheduleData && window.lastScheduleData[0] && window.lastScheduleData[0][0];
        if (!sheetMonth) {
            console.error("No se pudo determinar el mes de la hoja 'Month'.");
            return; // Salir si no podemos obtener el mes
        }

        // Limpiar eventos previos
        specialEventsByDay = {};
        const eventsForList = []; // Array para la lista debajo del calendario

        const monthNames = {
            1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR',
            5: 'MAY', 6: 'JUN', 7: 'JUL', 8: 'AUG',
            9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC'
        };

        // Procesar los eventos desde la hoja "Eventos"
        data.table.rows.slice(1).forEach(row => {
            // Asegurarse que la fila y la celda de fecha existen
            if (!row || !row.c || !row.c[0] || !row.c[0].v) return;

            const [date, venue, dj, djRequired, schedule, description] = row.c.map(cell => cell ? cell.v : '');
            if (!date) return; // Saltar si no hay fecha

            const dateParts = date.split('/');
            if (dateParts.length !== 3) return; // Saltar si el formato de fecha es incorrecto

            const day = parseInt(dateParts[0], 10);
            const eventMonthNum = parseInt(dateParts[1], 10);
            const year = parseInt(dateParts[2], 10); // Podrías usar el año para filtrar también si es necesario

            // Verificar si el evento pertenece al mes mostrado en la hoja 'Month'
            if (monthNames[eventMonthNum] === sheetMonth) {
                // Poblar para el resaltado del calendario
                specialEventsByDay[day] = {
                    venue,
                    dj,
                    djRequired,
                    schedule,
                    description
                };
                // Añadir a la lista para renderizar debajo
                eventsForList.push({
                    date,
                    venue,
                    dj,
                    djRequired,
                    schedule,
                    description
                });
            }
        });

        // Renderizar la lista de eventos debajo del calendario
        renderSpecialEvents(eventsForList);

        // Volver a renderizar la tabla del calendario para aplicar los estilos de eventos
        if (window.lastScheduleData) {
            renderWeeklyTables(window.lastScheduleData);
        } else {
            console.error("window.lastScheduleData no está disponible para re-renderizar la tabla.");
        }

    } catch (error) {
        console.error('Error loading special events:', error);
    }
}

// Eliminar la función processEventsForCalendar ya que su lógica está ahora en fetchSpecialEvents
/*
function processEventsForCalendar(events) {
    if (!events || events.length <= 1) return;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    
    events.slice(1).forEach(event => {
        if (!event[0]) return;
        
        const [dateStr, venue, dj, djRequired] = event;
        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) return;
        
        const eventDay = parseInt(dateParts[0], 10);
        const eventMonth = parseInt(dateParts[1], 10) - 1;
        
        if (eventMonth === currentMonth) {
            specialEventsByDay[eventDay] = {
                venue,
                dj,
                djRequired,
                schedule: event[4] || 'Todo el día',
                description: event[5] || ''
            };
        }
    });
}
*/

function renderSpecialEvents(events) {
    const container = document.getElementById('special-events');
    if (!container) {
        console.error('Contenedor #special-events no encontrado.');
        return;
    }

    container.innerHTML = `
        <div class="schedule-status">
            <h3>Schedule Status</h3>
            <div class="status-indicators">
                <div class="status-item">
                    <span class="status-dot current-shift"></span>
                    Current Shift
                </div>
                <div class="status-item">
                    <span class="status-dot special-no-dj"></span>
                    Special Event (No DJ Required)
                </div>
                <div class="status-item">
                    <span class="status-dot special-dj"></span>
                    Special Event (DJ Required)
                </div>
            </div>
        </div>
        <h3>Special Events</h3>
    `;

    if (!events || events.length === 0) {
        container.innerHTML += '<p>No upcoming special events for this month</p>'; // Mensaje más específico
        return;
    }

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'special-events-container';

    events.forEach(event => {
        const dateParts = event.date.split('/');
        // Asegurarse que el formato es correcto antes de crear la fecha
        if (dateParts.length !== 3) return;
        const eventDate = new Date(dateParts[2], parseInt(dateParts[1])-1, dateParts[0]);
        // Validar la fecha creada
        if (isNaN(eventDate.getTime())) return;

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[eventDate.getDay()];

        const eventElement = document.createElement('div');
        eventElement.className = 'special-event-item';

        // Asegurarse que las propiedades existen antes de usarlas
        const scheduleText = event.schedule || 'N/A';
        const descriptionText = event.description || 'No description';
        const djText = event.dj || 'N/A';
        const djStatusText = event.djRequired === 'Yes' ?
                    `DJ must attend (${djText})` :
                    `DJ not required (${djText})`;

        eventElement.innerHTML = `
            <div class="event-header">
                ${event.date} (${dayName}) ${event.venue || 'N/A'}
            </div>
            <div class="event-info">
                <span class="time-icon">⌚ ${scheduleText}</span>
                <span class="event-type">📝 ${descriptionText}</span>
                <span class="dj-status">👤 ${djStatusText}</span>
            </div>
        `;

        eventsContainer.appendChild(eventElement);
    });

    container.appendChild(eventsContainer);
}
