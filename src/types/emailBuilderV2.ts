// =============================================
// EMAIL BUILDER V2 - ENTERPRISE TYPES
// =============================================

export type BlockType = 
  | 'text' 
  | 'image' 
  | 'button' 
  | 'spacer' 
  | 'columns' 
  | 'banner' 
  | 'signature' 
  | 'divider' 
  | 'social'
  | 'html';

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'contains' 
  | 'is_empty' 
  | 'is_not_empty';

export type ConditionAction = 'show' | 'hide';
export type LogicGroup = 'AND' | 'OR';

export type ButtonAction = 'link' | 'download' | 'email' | 'phone';

export interface BlockContent {
  html?: string;
  text?: string;
  src?: string;
  url?: string;
  alt?: string;
  buttonText?: string;
  height?: number;
  columns?: number;
  links?: Array<{ platform: string; url: string }>;
  name?: string;
  role?: string;
  email?: string;
  // Button action types
  buttonAction?: ButtonAction;
  fileUrl?: string;
  emailSubject?: string;
  phone?: string;
}

export interface BlockStyles {
  backgroundColor?: string;
  color?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: string;
  fontWeight?: string;
  border?: string;
}

export interface ResponsiveSettings {
  mobile?: {
    hidden?: boolean;
    styles?: Partial<BlockStyles>;
  };
  desktop?: {
    hidden?: boolean;
    styles?: Partial<BlockStyles>;
  };
}

export interface EmailBlock {
  id: string;
  template_id: string;
  block_type: BlockType;
  position: number;
  content: BlockContent;
  styles: BlockStyles;
  responsive: ResponsiveSettings;
  parent_block_id?: string | null;
  column_index?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlockCondition {
  id: string;
  block_id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
  logic_group: LogicGroup;
  group_index: number;
  action: ConditionAction;
  created_at?: string;
}

export interface EmailTemplateV2 {
  id: string;
  name: string;
  description?: string;
  category: string;
  trigger_type?: string;
  default_subject?: string;
  default_preheader?: string;
  is_active: boolean;
  branding_id?: string;
  sender_id?: string;
  department_id?: string;
  version: number;
  legacy_template_id?: string;
  ab_testing_enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relations
  blocks?: EmailBlock[];
}

export interface EmailTemplateVariant {
  id: string;
  template_id: string;
  variant_name: string;
  subject: string;
  preheader?: string;
  blocks_override?: Record<string, Partial<EmailBlock>>;
  weight_percent: number;
  is_control: boolean;
  is_active: boolean;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_spam: number;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateTranslation {
  id: string;
  template_id: string;
  language_code: string;
  subject: string;
  preheader?: string;
  translated_blocks: Record<string, { content: BlockContent }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailSend {
  id: string;
  template_id?: string;
  variant_id?: string;
  contact_id?: string;
  deal_id?: string;
  ticket_id?: string;
  resend_email_id?: string;
  subject: string;
  recipient_email: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'failed';
  language_code: string;
  variables_used: Record<string, string>;
  error_message?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  sent_at: string;
}

export interface EmailEvent {
  id: string;
  send_id: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'replied';
  event_data: Record<string, any>;
  created_at: string;
}

export interface EmailLayout {
  id: string;
  name: string;
  description?: string;
  category: string;
  preview_image_url?: string;
  thumbnail_url?: string;
  blocks: Array<Omit<EmailBlock, 'id' | 'template_id'>>;
  default_styles: BlockStyles;
  is_system: boolean;
  is_active: boolean;
  usage_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailVariable {
  id: string;
  variable_key: string;
  display_name: string;
  category: string;
  data_type: 'string' | 'number' | 'date' | 'currency' | 'boolean';
  sample_value?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// Drag and Drop types
export interface DragItem {
  type: 'block' | 'existing-block';
  blockType?: BlockType;
  blockId?: string;
  index?: number;
}

// Builder state
export interface EmailBuilderState {
  template: EmailTemplateV2 | null;
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  previewMode: 'desktop' | 'mobile';
  isDirty: boolean;
}
