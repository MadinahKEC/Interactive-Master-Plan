/** Refined monochrome line icons (currentColor). No emoji — quiet, premium. */
type P = { size?: number };
const S = (size = 18) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IconDashboard = ({ size }: P) => (<svg {...S(size)}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>);
export const IconPlots = ({ size }: P) => (<svg {...S(size)}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>);
export const IconPalette = ({ size }: P) => (<svg {...S(size)}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>);
export const IconUsers = ({ size }: P) => (<svg {...S(size)}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5.5 5.5 0 0 0-2.8-4.8" /></svg>);
export const IconAudit = ({ size }: P) => (<svg {...S(size)}><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v4h4M9 12h7M9 16h7M9 8h2" /></svg>);
export const IconSettings = ({ size }: P) => (<svg {...S(size)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>);
export const IconClose = ({ size }: P) => (<svg {...S(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconEdit = ({ size }: P) => (<svg {...S(size)}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M14 6l4 4" /></svg>);
export const IconShape = ({ size }: P) => (<svg {...S(size)}><path d="M5 6l7-3 7 4-2 9-8 3-5-6 1-7Z" /><circle cx="5" cy="6" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="3" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="7" r="1.6" fill="currentColor" stroke="none" /><circle cx="17" cy="16" r="1.6" fill="currentColor" stroke="none" /><circle cx="9" cy="19" r="1.6" fill="currentColor" stroke="none" /></svg>);
export const IconMerge = ({ size }: P) => (<svg {...S(size)}><path d="M7 4v4a4 4 0 0 0 4 4h6" /><path d="M17 4v4a4 4 0 0 1-4 4H7" /><path d="M14 9l3 3-3 3" /></svg>);
export const IconSearch = ({ size }: P) => (<svg {...S(size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>);
export const IconZoom = ({ size }: P) => (<svg {...S(size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>);
export const IconBuilding = ({ size }: P) => (<svg {...S(size)}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></svg>);
export const IconOwner = ({ size }: P) => (<svg {...S(size)}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>);
export const IconLayers = ({ size }: P) => (<svg {...S(size)}><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5M3 8v0" /></svg>);
export const IconLink = ({ size }: P) => (<svg {...S(size)}><path d="M9 15l6-6M10.5 6.5l1.2-1.2a4 4 0 0 1 5.7 5.7l-1.2 1.2M13.5 17.5l-1.2 1.2a4 4 0 0 1-5.7-5.7l1.2-1.2" /></svg>);
export const IconHome = ({ size }: P) => (<svg {...S(size)}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h5v-5h2v5h5v-9" /></svg>);
export const IconPower = ({ size }: P) => (<svg {...S(size)}><path d="M12 4v8" /><path d="M7.5 7a7 7 0 1 0 9 0" /></svg>);
export const IconSatellite = ({ size }: P) => (<svg {...S(size)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.3 2.6 14.7 0 17M12 3.5c-2.6 2.3-2.6 14.7 0 17" /></svg>);
export const IconCube = ({ size }: P) => (<svg {...S(size)}><path d="M12 3 21 8v8l-9 5-9-5V8Z" /><path d="m12 3 9 5-9 5-9-5M12 13v8" /></svg>);
export const IconPen = ({ size }: P) => (<svg {...S(size)}><path d="M15 4l5 5L9 20l-5 1 1-5L15 4Z" /><path d="M13 6l5 5" /></svg>);
export const IconAdmin = ({ size }: P) => (<svg {...S(size)}><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconTag = ({ size }: P) => (<svg {...S(size)}><path d="M11 3H5a2 2 0 0 0-2 2v6l9 9 8-8-9-9Z" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></svg>);
export const IconExport = ({ size }: P) => (<svg {...S(size)}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></svg>);
export const IconSplit = ({ size }: P) => (<svg {...S(size)}><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M12 5v14M4 12h8" /></svg>);
export const IconText = ({ size }: P) => (<svg {...S(size)}><path d="M5 5h14M12 5v14M9 19h6" /></svg>);
export const IconArrow = ({ size }: P) => (<svg {...S(size)}><path d="M5 19 19 5M11 5h8v8" /></svg>);
export const IconRect = ({ size }: P) => (<svg {...S(size)}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>);
export const IconCalendar = ({ size }: P) => (<svg {...S(size)}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9h17M8 3v4M16 3v4" /></svg>);
export const IconTrash = ({ size }: P) => (<svg {...S(size)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IconPlus = ({ size }: P) => (<svg {...S(size)}><path d="M12 5v14M5 12h14" /></svg>);
const IconHotel = ({ size }: P) => (<svg {...S(size)}><path d="M3 20V8l9-4 9 4v12" /><rect x="9" y="12" width="6" height="8" /><path d="M3 20h18M8 8h.01M16 8h.01" /></svg>);
const IconHospital = ({ size }: P) => (<svg {...S(size)}><rect x="5" y="4" width="14" height="17" rx="1.5" /><path d="M12 8v6M9 11h6" /></svg>);
const IconEducation = ({ size }: P) => (<svg {...S(size)}><path d="M12 5 3 9l9 4 9-4-9-4Z" /><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4" /></svg>);
const IconPark = ({ size }: P) => (<svg {...S(size)}><path d="M12 3c-3 3-4 6-4 8a4 4 0 0 0 8 0c0-2-1-5-4-8Z" /><path d="M12 15v6" /></svg>);
const IconRetail = ({ size }: P) => (<svg {...S(size)}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>);
const IconTransit2 = ({ size }: P) => (<svg {...S(size)}><rect x="6" y="4" width="12" height="13" rx="2" /><path d="M6 11h12M9 21l-2-2M15 21l2-2" /><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" /></svg>);

/** Elegant monochrome icon for a project type. */
export const TypeIcon = ({ typeKey, size }: { typeKey: string; size?: number }) => {
  switch (typeKey) {
    case 'Hotel': return <IconHotel size={size} />;
    case 'Hospital': case 'Medical': return <IconHospital size={size} />;
    case 'Education': return <IconEducation size={size} />;
    case 'Park': return <IconPark size={size} />;
    case 'Mall': case 'Commercial': return <IconRetail size={size} />;
    case 'Transit': return <IconTransit2 size={size} />;
    default: return <IconBuilding size={size} />;
  }
};
