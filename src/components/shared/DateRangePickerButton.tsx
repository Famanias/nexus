'use client';

import React, { useState } from 'react';
import {
  Box, Button, Popover, Typography, IconButton, Select, MenuItem,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';

export interface DateRangeValue {
  dateFrom: string;  // 'yyyy-MM-dd' or ''
  dateTo: string;    // 'yyyy-MM-dd' or ''
  isAllTime: boolean;
}

interface Props extends DateRangeValue {
  onChange: (value: DateRangeValue) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildWeeks(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function navMonth(month: number, year: number, dir: 1 | -1) {
  let m = month + dir;
  let y = year;
  if (m > 11) { m = 0; y++; }
  if (m < 0)  { m = 11; y--; }
  return { month: m, year: y };
}

// ─── inner CalendarGrid ────────────────────────────────────────────────────────

interface GridProps {
  year: number;
  month: number;
  yearOptions: number[];
  tempFrom: string;
  tempTo: string;
  hover: string;
  stage: 'from' | 'to';
  onPrev: () => void;
  onNext: () => void;
  onMonth: (m: number) => void;
  onYear:  (y: number) => void;
  onDayClick: (d: Date) => void;
  onDayHover: (ds: string) => void;
}

function CalendarGrid({
  year, month, yearOptions,
  tempFrom, tempTo, hover, stage,
  onPrev, onNext, onMonth, onYear,
  onDayClick, onDayHover,
}: GridProps) {
  const weeks = buildWeeks(year, month);

  // effective end for range-highlight (use hover if to isn't set yet)
  const effectiveTo = tempTo || (stage === 'to' && hover && hover >= tempFrom ? hover : '');

  return (
    <Box sx={{ minWidth: 256 }}>
      {/* month / year nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
        <IconButton size="small" onClick={onPrev} sx={{ color: 'rgba(255,255,255,0.6)', p: 0.5 }}>
          <PrevIcon fontSize="small" />
        </IconButton>
        <Select
          value={month}
          onChange={(e) => onMonth(Number(e.target.value))}
          size="small"
          sx={{
            flex: 1, color: '#fff', fontSize: 13,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiSelect-select': { py: 0.75, px: 1 },
          }}
        >
          {MONTHS.map((name, i) => <MenuItem key={i} value={i}>{name}</MenuItem>)}
        </Select>
        <Select
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          size="small"
          sx={{
            width: 76, color: '#fff', fontSize: 13,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiSelect-select': { py: 0.75, px: 1 },
          }}
        >
          {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </Select>
        <IconButton size="small" onClick={onNext} sx={{ color: 'rgba(255,255,255,0.6)', p: 0.5 }}>
          <NextIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* day-of-week headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.25 }}>
        {DAY_HEADERS.map((d) => (
          <Box key={d} sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', py: 0.5 }}>
            {d}
          </Box>
        ))}
      </Box>

      {/* day cells */}
      {weeks.map((week, wi) => (
        <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {week.map((day, di) => {
            if (!day) return <Box key={di} />;
            const ds = toDateStr(day);
            const isFrom = ds === tempFrom;
            const isTo   = ds === effectiveTo;
            const isSel  = isFrom || isTo;
            const inRange =
              tempFrom && effectiveTo &&
              ds > tempFrom && ds < effectiveTo;

            // pill edge rounding for range
            const isRangeStart = isFrom && !!effectiveTo;
            const isRangeEnd   = isTo && !!tempFrom;

            return (
              <Box
                key={di}
                onClick={() => onDayClick(day)}
                onMouseEnter={() => onDayHover(ds)}
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: 13,
                  py: 0.7,
                  userSelect: 'none',
                  // range fill (flat on the dot side)
                  bgcolor: inRange ? 'rgba(233,30,99,0.18)' : 'transparent',
                  borderTopLeftRadius:   isRangeStart ? 0 : inRange ? 0 : undefined,
                  borderBottomLeftRadius: isRangeStart ? 0 : inRange ? 0 : undefined,
                  borderTopRightRadius:   isRangeEnd  ? 0 : inRange ? 0 : undefined,
                  borderBottomRightRadius: isRangeEnd ? 0 : inRange ? 0 : undefined,
                }}
              >
                {/* the circle for selected start/end */}
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30, height: 30,
                    borderRadius: '50%',
                    bgcolor: isSel ? '#e91e63' : 'transparent',
                    color: isSel ? '#fff' : 'rgba(255,255,255,0.85)',
                    fontWeight: isSel ? 700 : 400,
                    '&:hover': {
                      bgcolor: isSel ? '#c2185b' : 'rgba(255,255,255,0.12)',
                    },
                  }}
                >
                  {day.getDate()}
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export default function DateRangePickerButton({ dateFrom, dateTo, isAllTime, onChange }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const today = new Date();
  const curMonth = today.getMonth();
  const curYear  = today.getFullYear();
  const [leftMonth,  setLeftMonth]  = useState(curMonth === 0 ? 11 : curMonth - 1);
  const [leftYear,   setLeftYear]   = useState(curMonth === 0 ? curYear - 1 : curYear);
  const [rightMonth, setRightMonth] = useState(curMonth);
  const [rightYear,  setRightYear]  = useState(curYear);

  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo,   setTempTo]   = useState(dateTo);
  const [hover,    setHover]    = useState('');
  const [stage,    setStage]    = useState<'from' | 'to'>('from');

  const yearOptions = Array.from({ length: 12 }, (_, i) => curYear - 6 + i);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setTempFrom(isAllTime ? '' : dateFrom);
    setTempTo(isAllTime   ? '' : dateTo);
    setStage('from');
    setHover('');
  };

  const handleCancel = () => setAnchorEl(null);

  const handleDone = () => {
    if (tempFrom && tempTo) {
      onChange({ dateFrom: tempFrom, dateTo: tempTo, isAllTime: false });
    }
    setAnchorEl(null);
  };

  const handleAllTime = () => {
    setTempFrom('');
    setTempTo('');
    onChange({ dateFrom: '', dateTo: '', isAllTime: true });
    setAnchorEl(null);
  };

  const handleDayClick = (d: Date) => {
    const ds = toDateStr(d);
    if (stage === 'from') {
      setTempFrom(ds);
      setTempTo('');
      setHover('');
      setStage('to');
    } else {
      if (ds < tempFrom) {
        // clicked before from → restart
        setTempFrom(ds);
        setTempTo('');
        setHover('');
      } else {
        setTempTo(ds);
        setStage('from');
        setHover('');
      }
    }
  };

  const handleDayHover = (ds: string) => {
    if (stage === 'to' && tempFrom) setHover(ds);
  };

  // button label
  const buttonLabel = (() => {
    if (isAllTime || (!dateFrom && !dateTo)) return 'All Time';
    if (dateFrom && dateTo) {
      const fmt = (s: string) => {
        const [y, m, dd] = s.split('-');
        return `${parseInt(m)}.${parseInt(dd)}.${y}`;
      };
      return `${fmt(dateFrom)} - ${fmt(dateTo)}`;
    }
    return 'Select Dates';
  })();

  // nav helpers
  const navLeft = (dir: 1 | -1) => {
    const n = navMonth(leftMonth, leftYear, dir);
    setLeftMonth(n.month); setLeftYear(n.year);
  };
  const navRight = (dir: 1 | -1) => {
    const n = navMonth(rightMonth, rightYear, dir);
    setRightMonth(n.month); setRightYear(n.year);
  };

  const sharedGridProps = { tempFrom, tempTo, hover, stage, yearOptions, onDayClick: handleDayClick, onDayHover: handleDayHover };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CalendarIcon fontSize="small" />}
        onClick={handleOpen}
        size="small"
        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
      >
        {buttonLabel}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCancel}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#16213e',
              borderRadius: 2,
              mt: 0.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <Box
          onMouseLeave={() => { if (stage === 'to') setHover(''); }}
          sx={{ p: 3, userSelect: 'none' }}
        >
          {/* calendars row */}
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 1, fontWeight: 600, letterSpacing: 0.5 }}>
                From:
              </Typography>
              <CalendarGrid
                year={leftYear} month={leftMonth}
                onPrev={() => navLeft(-1)} onNext={() => navLeft(1)}
                onMonth={setLeftMonth} onYear={setLeftYear}
                {...sharedGridProps}
              />
            </Box>

            <Box sx={{ width: '1px', bgcolor: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 1, fontWeight: 600, letterSpacing: 0.5 }}>
                To:
              </Typography>
              <CalendarGrid
                year={rightYear} month={rightMonth}
                onPrev={() => navRight(-1)} onNext={() => navRight(1)}
                onMonth={setRightMonth} onYear={setRightYear}
                {...sharedGridProps}
              />
            </Box>
          </Box>

          {/* footer */}
          <Box sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Button
              size="small"
              onClick={handleAllTime}
              sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 13 }}
            >
              All Time
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={handleCancel}
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!tempFrom || !tempTo}
                onClick={handleDone}
                sx={{
                  bgcolor: '#e91e63',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#c2185b' },
                  '&.Mui-disabled': { bgcolor: 'rgba(233,30,99,0.3)', color: 'rgba(255,255,255,0.3)' },
                }}
              >
                Done
              </Button>
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
