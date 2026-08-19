import { vars } from 'nativewind';

// Raw color values - update these and they sync everywhere
export const colors = {
  light: {
    '--primary': '53 109 76',
    '--primary-foreground': '243 245 240',
    '--card': '252 253 251',
    '--secondary': '232 237 230',
    '--secondary-foreground': '24 32 25',
    '--background': '243 245 240',
    '--popover': '252 253 251',
    '--popover-foreground': '24 32 25',
    '--muted': '232 237 230',
    '--muted-foreground': '104 114 105',
    '--destructive': '165 72 66',
    '--foreground': '24 32 25',
    '--border': '212 220 210',
    '--input': '212 220 210',
    '--ring': '53 109 76',
    '--accent': '232 237 230',
    '--accent-foreground': '53 109 76',
  },
  dark: {
    '--primary-foreground': '13 18 15',
    '--primary': '169 203 170',
    '--card': '21 27 23',
    '--secondary': '28 36 30',
    '--secondary-foreground': '240 244 237',
    '--background': '13 18 15',
    '--popover': '21 27 23',
    '--popover-foreground': '240 244 237',
    '--muted': '28 36 30',
    '--muted-foreground': '146 157 148',
    '--destructive': '227 162 155',
    '--foreground': '240 244 237',
    '--border': '48 58 50',
    '--input': '48 58 50',
    '--accent': '28 36 30',
    '--accent-foreground': '169 203 170',
    '--ring': '169 203 170',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
