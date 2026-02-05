export type Q3Entity = {
  classname: string;
  properties: Record<string, string>;
};

export type TriggerType = 'start' | 'stop' | 'checkpoint' | 'teleport';
