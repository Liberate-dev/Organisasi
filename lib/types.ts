export type CustomField = {
  id: string;
  key: string;
  value: string;
};

export type RundownItem = {
  id: string;
  date: string;
  start: string;
  durationMinutes: number;
  agenda: string;
  pic: string;
  location: string;
  notes: string;
  customFields: CustomField[];
};

export type Rundown = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: RundownItem[];
};

export type TemplateItemBlueprint = {
  start: string;
  durationMinutes: number;
  agenda: string;
  pic: string;
  location: string;
  notes: string;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  items: TemplateItemBlueprint[];
};

