import { DateTime } from 'meteor/quave:custom-type-date-time';
import { DateTimeType } from 'meteor/quave:custom-type-date-time/DateTimeType';

export const defaultFormatValue = ({ value, definition }) => {
  console.log(' value, definition ', value, definition);

  switch (definition?.type) {
    case DateTimeType:
      return value ? value.formatDate() : value;

    default:
      return value;
  }
};
