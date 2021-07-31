import React, { useState } from 'react';
import { Form } from 'meteor/quave:forms/Form';
import { useQuery, useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';

const defaultStyles = {
  buttonsCell: {
    padding: '8px',
  },
  table: {
    borderCollapse: 'collapse',
  },
  tr: {
    cursor: 'pointer',
    '& tr': {
      backgroundColor: '#ddd',
    },
  },
  th: { padding: '8px', border: '1px solid #ddd', margin: '0px' },
  td: { padding: '8px', border: '1px solid #ddd', margin: '0px' },
};

const DefaultListComponent = ({ columnNames, rows, crudActions }) => (
  <table style={defaultStyles.table}>
    <thead>
      <tr>
        {columnNames.map((name, index) => (
          <th
            key={`table-header-${name}-${rows[index]?.object._id}`}
            style={defaultStyles.th}
          >
            {name}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ values, object, rowActions }) => (
        <tr
          onClick={() => crudActions.goToObject(object._id)}
          key={`table-row-${object._id}`}
          style={defaultStyles.tr}
        >
          {values.map((value, index) => (
            <td
              key={`table-cell-${columnNames[index]}-${value}-${object._id}`}
              style={defaultStyles.td}
            >
              {`${value}`}
            </td>
          ))}
          <td style={defaultStyles.td}>
            <button
              onClick={event => {
                event.stopPropagation();
                rowActions.remove();
              }}
            >
              delete
            </button>
          </td>
        </tr>
      ))}
      <tr>
        <td style={defaultStyles.buttonsCell}>
          <button onClick={crudActions.goToNewObject}>NEW</button>
        </td>
      </tr>
    </tbody>
  </table>
);

const List = ({
  ListComponent,
  formatField,
  definition,
  pickColumns,
  omitColumns,
  transformBeforeUse,
  crudActions,
}) => {
  const { fields } = definition;
  const { data = {} } = useQuery(gql(definition.toGraphQLManyQuery()));
  const rawObjects = data[definition.graphQLManyQueryCamelCaseName] || [];
  const objects = transformBeforeUse
    ? rawObjects.map(object =>
        Object.fromEntries(
          Object.entries(object).map(([key, rawValue]) => {
            const value = transformBeforeUse(rawValue, fields[key], key);

            // Return value only if it's not null or undefined
            return [key, value ?? rawValue];
          })
        )
      )
    : rawObjects;
  const [removeMutation] = useMutation(
    gql(definition.toGraphQLEraseMutation())
  );

  if (omitColumns) {
    omitColumns.forEach(columnName =>
      // eslint-disable-next-line no-param-reassign
      objects.map(object => delete object[columnName])
    );
  }

  const columns = pickColumns || Object.keys(objects[0] || fields || {});
  const columnNames = columns.map(
    columnKey => fields[columnKey]?.label || columnKey
  );

  const rows =
    ListComponent &&
    objects.map(object => ({
      rowActions: {
        edit: () => crudActions.goToObject(object._id),
        remove: () =>
          removeMutation({
            variables: { _id: object._id },
            refetchQueries: [{ query: gql(definition.toGraphQLManyQuery()) }],
          }),
      },
      object,
      values: columns.map(
        key =>
          formatField({
            value: object[key],
            definition: fields[key],
            key,
          }) || object[key]
      ),
    }));

  return (
    <ListComponent
      crudActions={crudActions}
      columnNames={columnNames}
      rows={rows}
    />
  );
};

const getInitialValues = ({ isCreating, definition, id }) => {
  if (isCreating) {
    return { initialValues: {} };
  }

  const { data = {}, ...queryRest } = useQuery(
    gql(definition.toGraphQLOneQuery()),
    {
      variables: { _id: id },
    }
  );
  const { [definition.nameCamelCase]: editingObject } = data;

  return { initialValues: editingObject, ...queryRest };
};

const FormComponent = ({
  id,
  isCreating,
  definition,
  transformAfterUse,
  formProps,
  crudActions,
}) => {
  const { fields } = definition;
  const [saveObjectMutation] = useMutation(
    gql(definition.toGraphQLSaveMutation())
  );
  const { initialValues, loading } = getInitialValues({
    isCreating,
    definition,
    id,
  });
  console.log('initialValues', initialValues);

  if (loading) {
    return null;
  }

  return (
    <Form
      initialValues={initialValues}
      definition={definition}
      onSubmit={values => {
        const transformedValues = transformAfterUse
          ? Object.fromEntries(
              Object.entries(values).map(([key, rawValue]) => {
                const value = transformAfterUse(rawValue, fields[key], key);

                // Return value only if it's not null or undefined
                return [key, value ?? rawValue];
              })
            )
          : values;

        saveObjectMutation({
          variables: {
            [definition.nameCamelCase]: {
              _id: isCreating ? undefined : id,
              ...definition.toSimpleSchema().clean(transformedValues),
            },
          },
          refetchQueries: [{ query: gql(definition.toGraphQLManyQuery()) }],
        });

        crudActions.goToList();
      }}
      onClick={event => event.stopPropagation()}
      {...formProps}
    />
  );
};

export const Crud = ({
  objectId,
  isCreatingObject,
  definition,
  formatField = () => {},
  pickColumns,
  omitColumns,
  formProps: rawFormProps = {},
  transformBeforeUse,
  transformAfterUse,
  listComponent = DefaultListComponent,
}) => {
  const [id, setId] = useState(objectId);
  const [isCreating, setIsCreating] = useState(isCreatingObject);
  const goToList = () => {
    setId('');
    setIsCreating(false);
  };
  const goToObject = newObjectId => {
    setId(newObjectId);
    setIsCreating(false);
  };
  const goToNewObject = () => {
    setId('');
    setIsCreating(true);
  };

  const crudActions = { goToList, goToObject, goToNewObject };

  // Inject Save and Cancel buttons
  const formProps = {
    ...rawFormProps,
    actions: [
      ...(rawFormProps.actions || []),
      props => (
        <button onClick={goToList} style={{ marginRight: '1em' }} {...props}>
          cancel
        </button>
      ),
      props => (
        <button type="submit" {...props}>
          save
        </button>
      ),
    ],
  };

  return (
    <>
      {id || isCreating ? (
        <FormComponent
          transformAfterUse={transformAfterUse}
          definition={definition}
          id={id}
          isCreating={isCreating}
          formProps={formProps}
          crudActions={crudActions}
        />
      ) : (
        <List
          definition={definition}
          formatField={formatField}
          omitColumns={omitColumns}
          pickColumns={pickColumns}
          ListComponent={listComponent}
          transformBeforeUse={transformBeforeUse}
          crudActions={crudActions}
        />
      )}
    </>
  );
};
