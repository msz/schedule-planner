'use strict';

const LOCALSTORAGE_CLASSES_KEY = 'classes';

type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

interface ITime {
  hour: number;
  minutes: number;
}

function timeToString(time: ITime) {
  return `${pad(time.hour.toString(), 2)}:${pad(time.minutes.toString(), 2)}`;
}

interface IClassTime {
  day: Day;
  start: ITime;
  end: ITime;
}

function classTimeToString(classTime: IClassTime) {
  return `${classTime.day}, ${timeToString(classTime.start)}-${timeToString(
    classTime.end,
  )}`;
}

interface IClass {
  name: string;
  times: IClassTime[];
}

interface IScheduledClass {
  name: string;
  classTime: IClassTime;
}

interface ISchedule {
  Mon: IScheduledClass[];
  Tue: IScheduledClass[];
  Wed: IScheduledClass[];
  Thu: IScheduledClass[];
  Fri: IScheduledClass[];
}

function pad(n: string, width: number) {
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

function getClasses() {
  return JSON.parse(
    localStorage.getItem(LOCALSTORAGE_CLASSES_KEY) || '[]',
  ) as IClass[];
}

function saveClasses(classes: IClass[]) {
  localStorage.setItem(LOCALSTORAGE_CLASSES_KEY, JSON.stringify(classes));
}

function addClassTime(className: string, classTime: IClassTime) {
  const existing = classes.filter(x => x.name === className)[0];
  if (existing) {
    existing.times.push(classTime);
  } else {
    classes.push({
      name: className,
      times: [classTime],
    });
  }
  onClassesUpdated();
}

function renderClassList(classList: IClass[]) {
  const classListElement = document.getElementById('class-list');
  while (classListElement.firstChild) {
    classListElement.removeChild(classListElement.firstChild);
  }
  for (const cls of classList) {
    const classElement = document.createElement('li');
    classElement.textContent = cls.name;
    const timesListElement = document.createElement('ul');
    for (const classTime of cls.times) {
      const classTimeElement = document.createElement('li');
      classTimeElement.textContent = classTimeToString(classTime);

      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () =>
        removeClassTime(cls, classTime),
      );
      classTimeElement.appendChild(removeButton);

      timesListElement.appendChild(classTimeElement);
    }
    classElement.appendChild(timesListElement);
    classListElement.appendChild(classElement);
  }
}

function removeClassTime(cls: IClass, classTime: IClassTime) {
  if (cls.times.length === 1) {
    const clsIndex = classes.indexOf(cls);
    classes.splice(clsIndex, 1);
  } else {
    const classTimeIndex = cls.times.indexOf(classTime);
    cls.times.splice(classTimeIndex, 1);
  }
  onClassesUpdated();
}

function onClassesUpdated() {
  saveClasses(classes);
  renderClassList(classes);
}

function displayError(error: string) {
  document.getElementById('error').textContent = error;
}

function clearError() {
  document.getElementById('error').textContent = '';
}

function gt(t1: ITime, t2: ITime) {
  return t1.hour > t2.hour || (t1.hour === t2.hour && t1.minutes > t2.minutes);
}

function lt(t1: ITime, t2: ITime) {
  return t1.hour < t2.hour || (t1.hour === t2.hour && t1.minutes < t2.minutes);
}

function eq(t1: ITime, t2: ITime) {
  return t1.hour === t2.hour && t1.minutes === t2.minutes;
}

function between(target: ITime, t1: ITime, t2: ITime) {
  return gt(target, t1) && lt(target, t2);
}

function classTimesOverlap(t1: IClassTime, t2: IClassTime) {
  return (
    t1.day === t2.day &&
    (between(t1.start, t2.start, t2.end) ||
      between(t2.start, t1.start, t1.end) ||
      (eq(t1.start, t2.start) && eq(t1.end, t2.end)))
  );
}

function composeSchedules(classes: IClass[]) {
  console.log('composing classes:', classes);
  const queue: ISchedule[] = [
    {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
    },
  ];
  const completeSchedules: ISchedule[] = [];

  while (queue.length > 0) {
    const schedule = queue.shift();
    console.log('taking schedule', schedule);
    const classNames = ([] as IScheduledClass[])
      .concat(
        schedule.Mon,
        schedule.Tue,
        schedule.Wed,
        schedule.Thu,
        schedule.Fri,
      )
      .map(x => x.name);
    const classesToGo = classes.filter(x => classNames.indexOf(x.name) < 0);
    if (classesToGo.length === 0) {
      // all classes have timeslots assigned! save result
      console.log('all classes have timeslots assigned! save result');
      completeSchedules.push(schedule);
      continue;
    }
    const nextClass = classesToGo.shift();
    const validTimeslots = nextClass.times.filter(
      time =>
        !schedule[time.day].some(x => classTimesOverlap(x.classTime, time)),
    );
    for (const timeslot of validTimeslots) {
      const next = JSON.parse(JSON.stringify(schedule)) as ISchedule;
      next[timeslot.day].push({
        name: nextClass.name,
        classTime: timeslot,
      });
      queue.push(next);
    }
  }

  for (const schedule of completeSchedules) {
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as Day[]) {
      schedule[day].sort(
        (a, b) =>
          gt(a.classTime.start, b.classTime.start)
            ? 1
            : lt(a.classTime.start, b.classTime.start) ? -1 : 0,
      );
    }
  }
  console.log('returning', completeSchedules);
  return completeSchedules;
}

const classes: IClass[] = getClasses();

document.getElementById('save-button').addEventListener('click', () => {
  clearError();
  const classNameElement = document.getElementById(
    'class-name',
  ) as HTMLInputElement;
  const className = classNameElement.value;
  const selectValues = [
    'day',
    'start-hour',
    'start-minutes',
    'end-hour',
    'end-minutes',
  ].map(id => {
    const element = document.getElementById(id) as HTMLSelectElement;
    return element.options[element.selectedIndex].text;
  });
  const day = selectValues.shift() as Day;
  const [startHour, startMinutes, endHour, endMinutes] = selectValues.map(x =>
    parseInt(x),
  );

  if (!className) {
    displayError('Fill in the class name!');
    return;
  }

  const startTime = {
    hour: startHour,
    minutes: startMinutes,
  };
  const endTime = {
    hour: endHour,
    minutes: endMinutes,
  };

  if (gt(startTime, endTime) || eq(startTime, endTime)) {
    displayError('End time must be after start time!');
    return;
  }

  addClassTime(className, {
    day,
    start: startTime,
    end: endTime,
  });
});

document.getElementById('compute').addEventListener('click', () => {
  const schedules = composeSchedules(classes);
  const resultTag = document.getElementById('result-tag');
  while (resultTag.firstChild) {
    resultTag.removeChild(resultTag.firstChild);
  }

  const resultTitleElement = document.createElement('h2');
  resultTitleElement.textContent = 'Result';
  resultTag.appendChild(resultTitleElement);

  if (schedules.length === 0) {
    const resultTextElement = document.createElement('p');
    resultTextElement.textContent =
      'Could not create any valid schedules. Some times are conflicting';
    resultTag.appendChild(resultTextElement);
    return;
  }
  let i = 0;
  for (const schedule of schedules) {
    i++;
    const titleElement = document.createElement('h3');
    titleElement.textContent = `Schedule ${i}`;
    resultTag.appendChild(titleElement);

    const scheduleElement = document.createElement('ul');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as Day[]) {
      for (const scheduledClass of schedule[day]) {
        const scheduledClassElement = document.createElement('li');
        scheduledClassElement.textContent = `${classTimeToString(
          scheduledClass.classTime,
        )} — ${scheduledClass.name}`;
        scheduleElement.appendChild(scheduledClassElement);
      }
    }
    resultTag.appendChild(scheduleElement);
  }
});

renderClassList(classes);
