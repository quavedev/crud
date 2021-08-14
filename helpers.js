import { useLocation } from 'react-router-dom';

export const buildRoute = parts =>
  '/' +
  parts
    .map(part => part.replaceAll('/', ''))
    .filter(Boolean)
    .join('/');

export const getRidOfTheAnnoyingTypenameFieldDeep = value => {
  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    return value.map(getRidOfTheAnnoyingTypenameFieldDeep);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const { __typename, ...newValue } = value;

  for (let key in newValue) {
    if (newValue.hasOwnProperty(key)) {
      newValue[key] = getRidOfTheAnnoyingTypenameFieldDeep(newValue[key]);
    }
  }

  return newValue;
};

export const useUrlQuery = () => {
  return new URLSearchParams(useLocation().search);
};
