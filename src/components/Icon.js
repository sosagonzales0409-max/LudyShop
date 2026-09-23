import React from 'react';
import {
  ChevronLeft, X, ChevronRight, Settings, Tag, ClipboardList, CreditCard,
  BarChart2, DollarSign, Pencil, Plus, Trash2, Store, Package, Save, FileText,
  ChevronUp, ChevronDown, CornerUpLeft, AlertTriangle, Check, Info,
  ShoppingCart, Boxes, TrendingUp, Receipt, Coffee, ShoppingBag, Truck, History,
} from 'lucide-react-native';
import { colors, fontSize } from '../config/theme';

const STROKE = 2;

export const IconBack = props => (
  <ChevronLeft strokeWidth={STROKE} color={colors.primary} size={fontSize.heading} {...props} />
);

export const IconClose = props => (
  <X strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.heading} {...props} />
);

export const IconChevron = props => (
  <ChevronRight strokeWidth={STROKE} color={colors.textMuted} size={fontSize.itemTitle} {...props} />
);

export const IconSettings = props => (
  <Settings strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconTag = props => (
  <Tag strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconClipboard = props => (
  <ClipboardList strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconCreditCard = props => (
  <CreditCard strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconChart = props => (
  <BarChart2 strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconMoney = props => (
  <DollarSign strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconEdit = props => (
  <Pencil strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconTrash = props => (
  <Trash2 strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconPlus = props => (
  <Plus strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconStore = props => (
  <Store strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconPackage = props => (
  <Package strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconSave = props => (
  <Save strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconFile = props => (
  <FileText strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconChevronUp = props => (
  <ChevronUp strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconChevronDown = props => (
  <ChevronDown strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconCornerUp = props => (
  <CornerUpLeft strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconWarning = props => (
  <AlertTriangle strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconCheck = props => (
  <Check strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconInfo = props => (
  <Info strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.body} {...props} />
);

export const IconShoppingCart = props => (
  <ShoppingCart strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.heading} {...props} />
);

export const IconBoxes = props => (
  <Boxes strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.heading} {...props} />
);

export const IconTrendingUp = props => (
  <TrendingUp strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconReceipt = props => (
  <Receipt strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconCoffee = props => (
  <Coffee strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconShoppingBag = props => (
  <ShoppingBag strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconTruck = props => (
  <Truck strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);

export const IconHistory = props => (
  <History strokeWidth={STROKE} color={colors.textPrimary} size={fontSize.label} {...props} />
);