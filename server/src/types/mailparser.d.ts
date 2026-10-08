declare module 'mailparser' {
  export interface AddressObject {
    value: Array<{ address?: string; name?: string }>;
    text?: string;
  }

  export interface Attachment {
    content: Buffer;
    contentType: string;
    filename?: string;
    size?: number;
    contentId?: string;
    related?: boolean;
    disposition?: string;
  }

  export interface ParsedMail {
    messageId?: string;
    subject?: string;
    from?: AddressObject;
    to?: AddressObject;
    date?: Date;
    text?: string;
    htmlAsText?: string;
    html?: string;
    attachments?: Attachment[];
  }

  export function simpleParser(source: Buffer | string): Promise<ParsedMail>;
}
